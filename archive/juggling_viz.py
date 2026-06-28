"""Matplotlib drawing helpers for the juggling notebook."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Optional, Sequence, Tuple

import matplotlib.pyplot as plt
import matplotlib.transforms as mtransforms
import numpy as np
from matplotlib.patches import Circle, FancyBboxPatch

# ---------------------------------------------------------------------------
# Style
# ---------------------------------------------------------------------------

COLORS = {
    "bg": "#f6f7f9",
    "grid": "#dde1e8",
    "axis": "#4a5568",
    "ball_fill": "#e8564a",
    "ball_edge": "#b83a32",
    "ball_label": "#ffffff",
    "trajectory": "#5b7fa5",
    "trajectory_faint": "#8fa8c4",
    "hand_left": "#2f80ed",
    "hand_right": "#27ae60",
    "hand_edge": "#1a2332",
    "ellipse_trace": "#c5ced9",
    "catch_zone": "#f4a261",
    "throw_zone": "#2a9d8f",
    "info_box": "#eef1f6",
    "ground": "#8896a8",
}

FIG_W, FIG_H = 9.0, 5.0
INFO_BBOX = dict(
    boxstyle="round,pad=0.4",
    facecolor=COLORS["info_box"],
    edgecolor="#c8d0da",
    alpha=0.96,
)


def apply_plot_style() -> None:
    plt.rcParams.update(
        {
            "figure.facecolor": COLORS["bg"],
            "axes.facecolor": COLORS["bg"],
            "axes.edgecolor": COLORS["axis"],
            "axes.labelcolor": COLORS["axis"],
            "axes.titleweight": "600",
            "axes.titlesize": 12,
            "axes.labelsize": 10,
            "xtick.color": COLORS["axis"],
            "ytick.color": COLORS["axis"],
            "grid.color": COLORS["grid"],
            "grid.linestyle": "-",
            "grid.linewidth": 0.55,
            "font.size": 10,
        }
    )


apply_plot_style()


def section_header_html(title: str, subtitle: str = "") -> str:
    if subtitle:
        return (
            f"<div style='margin:0.2em 0 0.6em 0'>"
            f"<h3 style='margin:0;color:#1a2332'>{title}</h3>"
            f"<p style='margin:0.25em 0 0 0;color:#5c6570;font-size:0.92em'>{subtitle}</p>"
            f"</div>"
        )
    return f"<h3 style='margin:0.2em 0 0.6em 0;color:#1a2332'>{title}</h3>"


# ---------------------------------------------------------------------------
# Fixed stage bounds — plot size never jumps when ToF / apex changes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StageBounds:
    x_min: float
    x_max: float
    y_min: float
    y_max: float

    def apply(self, ax) -> None:
        ax.set_xlim(self.x_min, self.x_max)
        ax.set_ylim(self.y_min, self.y_max)
        # Fixed data aspect: changing y content does not rescale the axes box.
        width = self.x_max - self.x_min
        height = self.y_max - self.y_min
        ax.set_aspect(width / height, adjustable="box")
        ax.set_anchor("C")


VERTICAL_STAGE = StageBounds(x_min=-0.42, x_max=0.42, y_min=-0.06, y_max=5.0)


def two_hand_stage_bounds(cfg, motion_cfg=None) -> StageBounds:
    rx = motion_cfg.rx_m if motion_cfg else 0.0
    margin = 0.22
    x_min = cfg.left_x - rx - margin
    x_max = cfg.right_x + rx + margin
    # Max apex for throw 13 @ beat 0.5 s with inside/outside hand heights
    y_max = 3.8
    return StageBounds(x_min=x_min, x_max=x_max, y_min=-0.10, y_max=y_max)


def _style_axes(ax, title: Optional[str] = None) -> None:
    ax.axhline(0, color=COLORS["ground"], linewidth=1.2, zorder=0)
    ax.grid(True, alpha=0.45)
    ax.set_xlabel("x (m)")
    ax.set_ylabel("height (m)")
    if title:
        ax.set_title(title, pad=8)


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------


def _make_figure(title: str = ""):
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    fig.patch.set_facecolor(COLORS["bg"])
    if title:
        ax.set_title(title, pad=8)
    return fig, ax


class HandMarker:
    """Updateable hand glyph — no remove/recreate per frame."""

    def __init__(self, ax, is_left: bool):
        self.ax = ax
        self.is_left = is_left
        self.color = COLORS["hand_left"] if is_left else COLORS["hand_right"]
        self.label = "L" if is_left else "R"
        self._transform = mtransforms.Affine2D() + ax.transData
        self.palm = FancyBboxPatch(
            (-0.07, -0.026),
            0.14,
            0.052,
            boxstyle="round,pad=0.006",
            facecolor=self.color,
            edgecolor=COLORS["hand_edge"],
            linewidth=0.9,
            alpha=0.92,
            transform=self._transform,
            zorder=4,
        )
        ax.add_patch(self.palm)
        self.tag = ax.text(
            0, 0, self.label,
            ha="center", va="top",
            fontsize=10, fontweight="bold",
            color=self.color, zorder=5,
        )

    def set_pose(self, x: float, y: float, angle_rad: float = 0.0):
        self._transform = (
            mtransforms.Affine2D().rotate(angle_rad).translate(x, y) + self.ax.transData
        )
        self.palm.set_transform(self._transform)
        self.tag.set_position((x, y - 0.07))


def draw_ball(ax, x, y, radius=0.045, label=None, zorder=6, alpha=1.0):
    ball = Circle(
        (x, y), radius=radius,
        facecolor=COLORS["ball_fill"],
        edgecolor=COLORS["ball_edge"],
        linewidth=1.2,
        alpha=alpha, zorder=zorder,
    )
    ax.add_patch(ball)
    if label:
        ax.text(
            x, y, str(label),
            ha="center", va="center",
            fontsize=8, fontweight="bold",
            color=COLORS["ball_label"], zorder=zorder + 1,
        )
    return ball


def draw_zone_markers(ax, cfg, motion_cfg, hand_position_fn: Callable):
    """Small dots marking throw (inside) and catch (outside) slots on each ellipse."""
    for name, color in [("Left", COLORS["throw_zone"]), ("Right", COLORS["throw_zone"])]:
        x, y, _ = hand_position_fn(name, _throw_phase_time(name, cfg), cfg, motion_cfg)
        ax.plot(x, y, "o", color=color, ms=5, alpha=0.55, zorder=2)
    for name, color in [("Left", COLORS["catch_zone"]), ("Right", COLORS["catch_zone"])]:
        x, y, _ = hand_position_fn(name, _catch_phase_time(name, cfg), cfg, motion_cfg)
        ax.plot(x, y, "s", color=color, ms=5, alpha=0.55, zorder=2)


def _throw_phase_time(hand_name: str, cfg) -> float:
    """Absolute time when this hand is at its throw (inside) point."""
    beat_period = cfg.beat_period_s
    if hand_name.lower().startswith("l"):
        return beat_period  # odd beat: 1, 3, 5 … → first inside at t = T
    return 0.0


def _catch_phase_time(hand_name: str, cfg) -> float:
    """Absolute time when this hand is at its catch (outside) point."""
    beat_period = cfg.beat_period_s
    if hand_name.lower().startswith("l"):
        return 0.0
    return beat_period


def draw_ellipse_guides(ax, cfg, motion_cfg):
    for is_left, cx in [(True, cfg.left_x), (False, cfg.right_x)]:
        t = np.linspace(0, 2 * math.pi, 100)
        if is_left:
            xs = cx + motion_cfg.rx_m * np.cos(t)
        else:
            xs = cx - motion_cfg.rx_m * np.cos(t)
        ys = cfg.hand_height_m + motion_cfg.ry_m * np.sin(t)
        ax.plot(xs, ys, color=COLORS["ellipse_trace"], lw=0.9, alpha=0.45, zorder=1)


# ---------------------------------------------------------------------------
# Scene renderers (single output widget — scrub with slider / Play)
# ---------------------------------------------------------------------------


def render_vertical_throw(
    throw,
    cfg,
    t_abs: float,
    bounds: StageBounds = VERTICAL_STAGE,
    title: str = "",
):
    fig, ax = _make_figure(title)
    bounds.apply(ax)
    _style_axes(ax)

    _, xs, ys = throw.trajectory(160)
    ax.plot(xs, ys, color=COLORS["trajectory"], ls="--", lw=1.5, alpha=0.65, zorder=2)

    x, y = throw.position_at(t_abs)
    draw_ball(ax, x, y, radius=cfg.ball_radius_m)

    elapsed = max(0.0, min(throw.tof_s, t_abs - throw.start_time_s))
    ax.text(
        0.02, 0.97,
        f"t = {elapsed:.2f} / {throw.tof_s:.2f} s\n"
        f"vy₀ = {throw.vy0:.2f} m/s\n"
        f"E₀ = {throw.energy_j:.3f} J\n"
        f"apex = {throw.apex_height_m:.2f} m",
        transform=ax.transAxes, va="top", bbox=INFO_BBOX,
    )
    fig.subplots_adjust(left=0.09, right=0.97, top=0.92, bottom=0.11)
    plt.show()
    plt.close(fig)


def render_throw_scene(
    throw,
    cfg,
    t_abs: float,
    title: str = "",
    motion_cfg=None,
    hand_position_fn: Optional[Callable] = None,
):
    bounds = two_hand_stage_bounds(cfg, motion_cfg)
    fig, ax = _make_figure(title)
    bounds.apply(ax)
    _style_axes(ax)

    if motion_cfg is not None and hand_position_fn is not None:
        draw_ellipse_guides(ax, cfg, motion_cfg)
        draw_zone_markers(ax, cfg, motion_cfg, hand_position_fn)
        left = HandMarker(ax, is_left=True)
        right = HandMarker(ax, is_left=False)
        for name, marker in [("Left", left), ("Right", right)]:
            x, y, ang = hand_position_fn(name, t_abs, cfg, motion_cfg)
            marker.set_pose(x, y, ang)
    else:
        left = HandMarker(ax, is_left=True)
        right = HandMarker(ax, is_left=False)
        left.set_pose(cfg.left_x, cfg.hand_height_m)
        right.set_pose(cfg.right_x, cfg.hand_height_m)

    _, xs, ys = throw.trajectory(160)
    ax.plot(xs, ys, color=COLORS["trajectory"], ls="--", lw=1.5, alpha=0.6, zorder=2)
    ax.plot(*throw.start_xy, "o", color=COLORS["throw_zone"], ms=6, zorder=3)
    ax.plot(*throw.end_xy, "s", color=COLORS["catch_zone"], ms=6, zorder=3)

    x, y = throw.position_at(t_abs)
    draw_ball(ax, x, y, radius=cfg.ball_radius_m, label=throw.label)

    elapsed = max(0.0, min(throw.tof_s, t_abs - throw.start_time_s))
    ax.text(
        0.02, 0.97,
        f"t = {elapsed:.2f} / {throw.tof_s:.2f} s\n"
        f"vx₀ = {throw.vx0:.2f}  vy₀ = {throw.vy0:.2f} m/s\n"
        f"E₀ = {throw.energy_j:.3f} J  apex = {throw.apex_height_m:.2f} m",
        transform=ax.transAxes, va="top", bbox=INFO_BBOX,
    )
    fig.subplots_adjust(left=0.08, right=0.97, top=0.90, bottom=0.11)
    plt.show()
    plt.close(fig)


def render_sequence_scene(
    throws: Sequence,
    cfg,
    t_abs: float,
    values: Sequence[int],
    title: str = "",
    motion_cfg=None,
    hand_position_fn: Optional[Callable] = None,
):
    bounds = two_hand_stage_bounds(cfg, motion_cfg)
    fig, ax = _make_figure(title)
    bounds.apply(ax)
    _style_axes(ax)

    if motion_cfg and hand_position_fn:
        draw_ellipse_guides(ax, cfg, motion_cfg)
        left = HandMarker(ax, is_left=True)
        right = HandMarker(ax, is_left=False)
        for name, marker in [("Left", left), ("Right", right)]:
            x, y, ang = hand_position_fn(name, t_abs, cfg, motion_cfg)
            marker.set_pose(x, y, ang)

    for th in throws:
        _, xs, ys = th.trajectory(100)
        ax.plot(xs, ys, color=COLORS["trajectory_faint"], ls="--", lw=0.9, alpha=0.18, zorder=2)
        if th.start_time_s <= t_abs <= th.end_time_s:
            x, y = th.position_at(t_abs)
            draw_ball(ax, x, y, radius=cfg.ball_radius_m, label=th.label)

    ax.text(
        0.02, 0.97,
        f"time = {t_abs:.2f} s  ·  beat = {t_abs / cfg.beat_period_s:.1f}\n"
        f"pattern = {list(values)}",
        transform=ax.transAxes, va="top", bbox=INFO_BBOX,
    )
    fig.subplots_adjust(left=0.08, right=0.97, top=0.90, bottom=0.11)
    plt.show()
    plt.close(fig)


# Backward-compatible aliases
draw_throw_static = render_throw_scene
draw_sequence_frame = render_sequence_scene
