"""Build a clean juggling notebook (run once to regenerate)."""

import json
from pathlib import Path

NB_PATH = Path(__file__).parent / "juggling_0.ipynb"

cells = []

def md(source: str):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)})

def code(source: str):
    cells.append({
        "cell_type": "code",
        "metadata": {},
        "source": source.splitlines(keepends=True),
        "execution_count": None,
        "outputs": [],
    })

md("""# Juggling physics notebook

This notebook builds up cascade juggling from first principles:

1. **One ball** — time of flight and throw energy are two views of the same parabola.
2. **Siteswap throws** — each throw number sets how many beats the ball stays in the air.
3. **Two-hand motion** — hands trace ellipses in the frontal plane; catches happen on the outside, throws from the inside.
4. **Sequences & patterns** — string throws together and check siteswap validity.

Visualization lives in `juggling_viz.py` so this notebook stays focused on the physics.""")

code("""pip install numpy matplotlib ipywidgets""")

code("""import math
from dataclasses import dataclass
from typing import Tuple, List, Sequence, Dict, Optional

import numpy as np
import ipywidgets as widgets
from IPython.display import display, clear_output

from juggling_viz import (
    apply_plot_style,
    section_header_html,
    render_vertical_throw,
    render_throw_scene,
    render_sequence_scene,
)

apply_plot_style()""")

md("""## Core objects and vertical throw energy

A ball of mass `m` launched vertically from height 0 and caught at height 0 satisfies:

$$y(T) = 0 = v_y T - \\tfrac{1}{2} g T^2 \\quad\\Rightarrow\\quad v_y = \\frac{gT}{2}$$

So **time of flight** and **launch energy** $E = \\tfrac{1}{2} m v_y^2$ carry the same information.""")

code("""@dataclass
class PhysicsConfig:
    mass_kg: float = 0.100
    g: float = 9.81
    beat_period_s: float = 0.50
    hand_separation_m: float = 0.80
    hand_height_m: float = 0.0
    ball_radius_m: float = 0.045

    @property
    def left_x(self) -> float:
        return -self.hand_separation_m / 2

    @property
    def right_x(self) -> float:
        return self.hand_separation_m / 2


@dataclass
class Hand:
    name: str
    x: float
    y: float = 0.0

    @property
    def is_left(self) -> bool:
        return self.name.lower().startswith("l")


@dataclass
class Ball:
    mass_kg: float = 0.100
    radius_m: float = 0.045
    label: str = ""


def vertical_velocity_from_tof(tof_s: float, g: float = 9.81) -> float:
    \"\"\"Same launch and landing height: v_y = gT/2.\"\"\"
    return g * tof_s / 2


def tof_from_vertical_velocity(vy0: float, g: float = 9.81) -> float:
    return 2 * vy0 / g


def vertical_energy_from_tof(mass_kg: float, tof_s: float, g: float = 9.81) -> float:
    vy0 = vertical_velocity_from_tof(tof_s, g)
    return 0.5 * mass_kg * vy0**2


def tof_from_vertical_energy(mass_kg: float, energy_j: float, g: float = 9.81) -> float:
    if energy_j < 0:
        raise ValueError("Energy must be non-negative.")
    vy0 = math.sqrt(2 * energy_j / mass_kg)
    return tof_from_vertical_velocity(vy0, g)


def kinetic_energy(mass_kg: float, vx: float, vy: float) -> float:
    return 0.5 * mass_kg * (vx**2 + vy**2)""")

code("""@dataclass
class ProjectileThrow:
    \"\"\"Parabolic throw from start_xy to end_xy in tof_s seconds.\"\"\"

    start_xy: Tuple[float, float]
    end_xy: Tuple[float, float]
    tof_s: float
    mass_kg: float = 0.100
    g: float = 9.81
    start_time_s: float = 0.0
    label: str = ""

    def __post_init__(self):
        if self.tof_s <= 0:
            raise ValueError("Time of flight must be positive.")

    @property
    def end_time_s(self) -> float:
        return self.start_time_s + self.tof_s

    @property
    def vx0(self) -> float:
        x0, _ = self.start_xy
        x1, _ = self.end_xy
        return (x1 - x0) / self.tof_s

    @property
    def vy0(self) -> float:
        _, y0 = self.start_xy
        _, y1 = self.end_xy
        return (y1 - y0 + 0.5 * self.g * self.tof_s**2) / self.tof_s

    @property
    def speed0(self) -> float:
        return math.hypot(self.vx0, self.vy0)

    @property
    def energy_j(self) -> float:
        return kinetic_energy(self.mass_kg, self.vx0, self.vy0)

    @property
    def apex_height_m(self) -> float:
        t = self.vy0 / self.g
        _, y0 = self.start_xy
        return y0 + self.vy0 * t - 0.5 * self.g * t**2

    def position_at(self, t_abs: float) -> Tuple[float, float]:
        if t_abs <= self.start_time_s:
            return self.start_xy
        if t_abs >= self.end_time_s:
            return self.end_xy
        tau = t_abs - self.start_time_s
        x0, y0 = self.start_xy
        x = x0 + self.vx0 * tau
        y = y0 + self.vy0 * tau - 0.5 * self.g * tau**2
        return x, y

    def trajectory(self, n: int = 200):
        ts = np.linspace(self.start_time_s, self.end_time_s, n)
        xy = np.array([self.position_at(t) for t in ts])
        return ts, xy[:, 0], xy[:, 1]""")

code("""def make_hand(name: str, cfg: PhysicsConfig) -> Hand:
    name = name.lower()
    if name.startswith("l"):
        return Hand("Left", cfg.left_x, cfg.hand_height_m)
    if name.startswith("r"):
        return Hand("Right", cfg.right_x, cfg.hand_height_m)
    raise ValueError("Hand must be 'Left' or 'Right'.")


def opposite_hand(hand: Hand, cfg: PhysicsConfig) -> Hand:
    if hand.is_left:
        return make_hand("Right", cfg)
    return make_hand("Left", cfg)


def landing_hand_for_siteswap(start_hand: Hand, throw_value: int, cfg: PhysicsConfig) -> Hand:
    \"\"\"Odd throws cross; even throws stay in the same hand.\"\"\"
    if throw_value % 2 == 1:
        return opposite_hand(start_hand, cfg)
    return start_hand""")

md("""## Elliptical hand motion (frontal plane)

Real cascade juggling does not keep the hands fixed on a line. Each hand traces an **ellipse** seen from the front:

- **Left hand** moves **clockwise**, **right hand** **counter-clockwise**.
- The two hands are about **180° out of phase** — when one is outside, the other is inside.
- **Catches** happen on the **outside** of the loop (farther from the body centerline).
- **Throws** leave from the **inside** of the loop (closer to center).

We parametrize a **2-beat hand cycle** ($\\omega = \\pi / T_{\\text{beat}}$) so each hand returns to its throw point every two beats — matching a cascade where right throws on beats 0, 2, 4 … and left on beats 1, 3, 5 …

| hand | angle | horizontal | vertical |
|------|-------|------------|----------|
| right | $\\omega t$ | $x = x_0 - r_x \\cos\\theta$ | $y = y_0 + r_y \\sin\\theta$ |
| left | $\\omega t + \\pi$ | $x = x_0 + r_x \\cos\\theta$ | $y = y_0 + r_y \\sin\\theta$ |

Green dots = throw (inside), orange squares = catch (outside). Ball endpoints use those slots; the scrubber moves hands continuously along the loop.""")

code("""@dataclass
class HandMotionConfig:
    rx_m: float = 0.10
    ry_m: float = 0.06


def hand_phase_rad(hand_name: str, t_abs: float, cfg: PhysicsConfig) -> float:
    # 2-beat cycle: each hand throws every other beat (R on even, L on odd).
    omega = math.pi / cfg.beat_period_s
    if hand_name.lower().startswith("l"):
        return omega * t_abs + math.pi
    return omega * t_abs


def _hand_xy_from_theta(hand_name: str, theta: float, cfg: PhysicsConfig, motion: HandMotionConfig):
    is_left = hand_name.lower().startswith("l")
    center_x = cfg.left_x if is_left else cfg.right_x
    center_y = cfg.hand_height_m
    if is_left:
        x = center_x + motion.rx_m * math.cos(theta)
    else:
        x = center_x - motion.rx_m * math.cos(theta)
    y = center_y + motion.ry_m * math.sin(theta)
    return x, y


def hand_position(hand_name: str, t_abs: float, cfg: PhysicsConfig, motion: HandMotionConfig):
    theta = hand_phase_rad(hand_name, t_abs, cfg)
    x, y = _hand_xy_from_theta(hand_name, theta, cfg, motion)
    omega = math.pi / cfg.beat_period_s
    x2, y2 = _hand_xy_from_theta(hand_name, theta + omega * 0.02, cfg, motion)
    angle = math.atan2(y2 - y, x2 - x)
    return x, y, angle


def _throw_phase_time(hand_name: str, cfg: PhysicsConfig) -> float:
    if hand_name.lower().startswith("l"):
        return cfg.beat_period_s
    return 0.0


def _catch_phase_time(hand_name: str, cfg: PhysicsConfig) -> float:
    if hand_name.lower().startswith("l"):
        return 0.0
    return cfg.beat_period_s


def hand_xy_inside(hand_name: str, cfg: PhysicsConfig, motion: HandMotionConfig):
    t = _throw_phase_time(hand_name, cfg)
    x, y, _ = hand_position(hand_name, t, cfg, motion)
    return x, y


def hand_xy_outside(hand_name: str, cfg: PhysicsConfig, motion: HandMotionConfig):
    t = _catch_phase_time(hand_name, cfg)
    x, y, _ = hand_position(hand_name, t, cfg, motion)
    return x, y


def make_siteswap_throw(
    throw_value: int,
    start_hand_name: str = "Right",
    cfg: PhysicsConfig = PhysicsConfig(),
    start_beat: int = 0,
    motion: Optional[HandMotionConfig] = None,
) -> ProjectileThrow:
    start_hand = make_hand(start_hand_name, cfg)
    end_hand = landing_hand_for_siteswap(start_hand, throw_value, cfg)
    tof_s = throw_value * cfg.beat_period_s
    start_time_s = start_beat * cfg.beat_period_s

    if motion is None:
        start_xy = (start_hand.x, start_hand.y)
        end_xy = (end_hand.x, end_hand.y)
    else:
        start_xy = hand_xy_inside(start_hand.name, cfg, motion)
        end_xy = hand_xy_outside(end_hand.name, cfg, motion)

    return ProjectileThrow(
        start_xy=start_xy,
        end_xy=end_xy,
        tof_s=tof_s,
        mass_kg=cfg.mass_kg,
        g=cfg.g,
        start_time_s=start_time_s,
        label=str(throw_value),
    )


DEFAULT_HAND_MOTION = HandMotionConfig()""")

code("""mass_slider = widgets.FloatSlider(
    value=0.100, min=0.030, max=0.250, step=0.005,
    description="mass kg", readout_format=".3f", continuous_update=False,
)
tof_slider = widgets.FloatSlider(
    value=1.00, min=0.10, max=4.00, step=0.05,
    description="ToF s", readout_format=".2f", continuous_update=False,
)
energy_slider = widgets.FloatSlider(
    value=vertical_energy_from_tof(0.100, 1.00), min=0.001, max=20.0, step=0.01,
    description="energy J", readout_format=".3f", continuous_update=False,
)
lock_selector = widgets.ToggleButtons(
    options=[("fix time → compute energy", "time"), ("fix energy → compute time", "energy")],
    value="time", description="mode",
)
time_slider = widgets.FloatSlider(
    value=0.0, min=0.0, max=1.0, step=0.01,
    description="time", readout_format=".2f", continuous_update=True,
)
play_widget = widgets.Play(value=0, min=0, max=100, step=1, interval=40, description="▶")
play_frame = widgets.IntSlider(value=0, min=0, max=100, step=1, layout=widgets.Layout(width="0px", display="none"))
widgets.jslink((play_widget, "value"), (play_frame, "value"))
single_output = widgets.Output()
_is_syncing = False


def sync_energy_time(change=None):
    global _is_syncing
    if _is_syncing:
        return
    _is_syncing = True
    m = mass_slider.value
    if lock_selector.value == "time":
        tof_slider.disabled = False
        energy_slider.disabled = True
        energy_slider.value = vertical_energy_from_tof(m, tof_slider.value)
    else:
        tof_slider.disabled = True
        energy_slider.disabled = False
        tof_slider.value = min(tof_slider.max, tof_from_vertical_energy(m, energy_slider.value))
    _is_syncing = False


def current_vertical_throw() -> ProjectileThrow:
    return ProjectileThrow(
        start_xy=(0.0, 0.0), end_xy=(0.0, 0.0),
        tof_s=tof_slider.value,
        mass_kg=mass_slider.value,
        label="",
    )


def _sync_play_to_time(*_):
    throw = current_vertical_throw()
    if throw.tof_s > 0:
        time_slider.value = play_frame.value / 100.0 * throw.tof_s


def redraw_single_throw(change=None):
    sync_energy_time()
    throw = current_vertical_throw()
    time_slider.max = throw.tof_s
    t = min(time_slider.value, throw.tof_s)
    with single_output:
        clear_output(wait=True)
        render_vertical_throw(
            throw,
            cfg=PhysicsConfig(mass_kg=mass_slider.value, ball_radius_m=0.045),
            t_abs=t,
            title="One vertical throw",
        )


for widget in [mass_slider, tof_slider, energy_slider, lock_selector]:
    widget.observe(redraw_single_throw, names="value")
time_slider.observe(redraw_single_throw, names="value")
play_frame.observe(_sync_play_to_time, names="value")
sync_energy_time()

display(widgets.VBox([
    widgets.HTML(section_header_html(
        "1. One ball: fix time or fix energy",
        "Drag time or press ▶ — one view, no separate animation button.",
    )),
    widgets.HBox([mass_slider, lock_selector]),
    widgets.HBox([tof_slider, energy_slider]),
    widgets.HBox([play_widget, time_slider]),
    single_output,
]))
redraw_single_throw()""")

code("""throw_value_slider = widgets.IntSlider(
    value=3, min=1, max=13, step=1, description="throw", continuous_update=False,
)
beat_period_slider = widgets.FloatSlider(
    value=0.50, min=0.20, max=1.20, step=0.05,
    description="beat s", readout_format=".2f", continuous_update=False,
)
hand_sep_slider = widgets.FloatSlider(
    value=0.80, min=0.30, max=1.50, step=0.05,
    description="hand sep", readout_format=".2f", continuous_update=False,
)
start_hand_selector = widgets.ToggleButtons(options=["Left", "Right"], value="Right", description="start")
siteswap_time = widgets.FloatSlider(
    value=0.0, min=0.0, max=1.5, step=0.01,
    description="time", readout_format=".2f", continuous_update=True,
)
siteswap_play = widgets.Play(value=0, min=0, max=100, step=1, interval=40, description="▶")
siteswap_play_frame = widgets.IntSlider(value=0, min=0, max=100, step=1, layout=widgets.Layout(width="0px", display="none"))
widgets.jslink((siteswap_play, "value"), (siteswap_play_frame, "value"))
siteswap_output = widgets.Output()


def current_siteswap_cfg() -> PhysicsConfig:
    return PhysicsConfig(
        beat_period_s=beat_period_slider.value,
        hand_separation_m=hand_sep_slider.value,
    )


def current_siteswap_throw() -> ProjectileThrow:
    return make_siteswap_throw(
        throw_value=throw_value_slider.value,
        start_hand_name=start_hand_selector.value,
        cfg=current_siteswap_cfg(),
        motion=DEFAULT_HAND_MOTION,
    )


def _sync_siteswap_play(*_):
    throw = current_siteswap_throw()
    if throw.tof_s > 0:
        siteswap_time.value = siteswap_play_frame.value / 100.0 * throw.tof_s


def redraw_siteswap_throw(change=None):
    cfg = current_siteswap_cfg()
    throw = current_siteswap_throw()
    siteswap_time.max = throw.tof_s
    t = min(siteswap_time.value, throw.tof_s)
    start_hand = make_hand(start_hand_selector.value, cfg)
    end_hand = landing_hand_for_siteswap(start_hand, throw_value_slider.value, cfg)
    title = f"Siteswap {throw_value_slider.value}: {start_hand.name} → {end_hand.name}"
    with siteswap_output:
        clear_output(wait=True)
        render_throw_scene(
            throw, cfg=cfg, t_abs=t, title=title,
            motion_cfg=DEFAULT_HAND_MOTION, hand_position_fn=hand_position,
        )
        parity = "odd → crosses hands" if throw_value_slider.value % 2 else "even → same hand"
        print(f"throw value: {throw_value_slider.value}  |  {parity}")
        print(f"ToF: {throw.tof_s:.2f} s  |  E₀: {throw.energy_j:.3f} J  |  apex: {throw.apex_height_m:.2f} m")


for widget in [throw_value_slider, beat_period_slider, hand_sep_slider, start_hand_selector]:
    widget.observe(redraw_siteswap_throw, names="value")
siteswap_time.observe(redraw_siteswap_throw, names="value")
siteswap_play_frame.observe(_sync_siteswap_play, names="value")

display(widgets.VBox([
    widgets.HTML(section_header_html(
        "2. Siteswap throw number (1–13)",
        "▶ scrubs time; hands move on ellipses (green = throw slot, orange = catch slot).",
    )),
    widgets.HBox([throw_value_slider, beat_period_slider, hand_sep_slider]),
    widgets.HBox([start_hand_selector, siteswap_play, siteswap_time]),
    siteswap_output,
]))
redraw_siteswap_throw()""")

code("""def parse_throw_sequence(text: str) -> List[int]:
    text = text.strip().replace(",", " ")
    if " " in text:
        return [int(x) for x in text.split() if x]
    return [int(ch) for ch in text if ch.isdigit()]


def make_manual_alternating_sequence(
    throw_values: Sequence[int],
    first_hand_name: str,
    cfg: PhysicsConfig,
    motion: Optional[HandMotionConfig] = None,
) -> List[ProjectileThrow]:
    throws = []
    first_is_left = first_hand_name.lower().startswith("l")
    for beat, value in enumerate(throw_values):
        hand_name = ("Left" if first_is_left else "Right") if beat % 2 == 0 else ("Right" if first_is_left else "Left")
        throws.append(make_siteswap_throw(
            throw_value=value,
            start_hand_name=hand_name,
            cfg=cfg,
            start_beat=beat,
            motion=motion,
        ))
    return throws""")

code("""sequence_text = widgets.Text(value="333333", description="throws", layout=widgets.Layout(width="350px"))
sequence_first_hand = widgets.ToggleButtons(options=["Left", "Right"], value="Right", description="first")
sequence_beat_period = widgets.FloatSlider(
    value=0.50, min=0.20, max=1.20, step=0.05,
    description="beat s", readout_format=".2f", continuous_update=False,
)
sequence_hand_sep = widgets.FloatSlider(
    value=0.80, min=0.30, max=1.50, step=0.05,
    description="hand sep", readout_format=".2f", continuous_update=False,
)
sequence_time = widgets.FloatSlider(
    value=0.0, min=0.0, max=3.0, step=0.01,
    description="time", readout_format=".2f", continuous_update=True,
)
sequence_play = widgets.Play(value=0, min=0, max=100, step=1, interval=40, description="▶")
sequence_play_frame = widgets.IntSlider(value=0, min=0, max=100, step=1, layout=widgets.Layout(width="0px", display="none"))
widgets.jslink((sequence_play, "value"), (sequence_play_frame, "value"))
sequence_output = widgets.Output()
sequence_end_time = 3.0


def current_sequence_cfg() -> PhysicsConfig:
    return PhysicsConfig(
        beat_period_s=sequence_beat_period.value,
        hand_separation_m=sequence_hand_sep.value,
    )


def _sync_sequence_play(*_):
    if sequence_end_time > 0:
        sequence_time.value = sequence_play_frame.value / 100.0 * sequence_end_time


def redraw_sequence(change=None):
    global sequence_end_time
    with sequence_output:
        clear_output(wait=True)
        try:
            values = parse_throw_sequence(sequence_text.value)
            if not values:
                raise ValueError("No throw values provided.")
            cfg = current_sequence_cfg()
            throws = make_manual_alternating_sequence(
                throw_values=values,
                first_hand_name=sequence_first_hand.value,
                cfg=cfg,
                motion=DEFAULT_HAND_MOTION,
            )
            sequence_end_time = max(th.end_time_s for th in throws)
            sequence_time.max = sequence_end_time
            t = min(sequence_time.value, sequence_end_time)
            render_sequence_scene(
                throws, cfg, t, values,
                title="Alternating-hand sequence",
                motion_cfg=DEFAULT_HAND_MOTION,
                hand_position_fn=hand_position,
            )
        except Exception as e:
            print(f"Could not draw sequence: {e}")


for widget in [sequence_text, sequence_first_hand, sequence_beat_period, sequence_hand_sep]:
    widget.observe(redraw_sequence, names="value")
sequence_time.observe(redraw_sequence, names="value")
sequence_play_frame.observe(_sync_sequence_play, names="value")

display(widgets.VBox([
    widgets.HTML(section_header_html(
        "3. Manual alternating-hand sequence",
        "Enter a siteswap string (e.g. 333, 531). ▶ plays the full timeline.",
    )),
    widgets.HBox([sequence_text, sequence_first_hand]),
    widgets.HBox([sequence_beat_period, sequence_hand_sep]),
    widgets.HBox([sequence_play, sequence_time]),
    sequence_output,
]))
redraw_sequence()""")

md("""## Siteswap validity (vanilla asynchronous)

A pattern of length $p$ with throw values $v_i$ is **valid** when landing residues $(i + v_i) \\bmod p$ are all distinct and the average $\\bar{v} = \\frac{1}{p}\\sum v_i$ is an integer (that integer is the ball count).""")

code("""class VanillaSiteswap:
    @staticmethod
    def parse(pattern: str) -> List[int]:
        pattern = pattern.lower().replace(" ", "").replace(",", "")
        values = []
        for ch in pattern:
            if ch.isdigit():
                values.append(int(ch))
            elif "a" <= ch <= "z":
                values.append(10 + ord(ch) - ord("a"))
            else:
                raise ValueError(f"Unsupported character: {ch}")
        if not values:
            raise ValueError("Empty pattern.")
        return values

    @staticmethod
    def ball_count(values: Sequence[int]) -> float:
        return sum(values) / len(values)

    @staticmethod
    def landing_residues(values: Sequence[int]) -> List[int]:
        p = len(values)
        return [(i + v) % p for i, v in enumerate(values)]

    @staticmethod
    def is_valid(values: Sequence[int]) -> bool:
        residues = VanillaSiteswap.landing_residues(values)
        unique_landings = len(set(residues)) == len(residues)
        integer_ball_count = VanillaSiteswap.ball_count(values).is_integer()
        return unique_landings and integer_ball_count

    @staticmethod
    def report(pattern: str) -> Dict:
        values = VanillaSiteswap.parse(pattern)
        return {
            "pattern": pattern,
            "values": values,
            "period": len(values),
            "average_ball_count": VanillaSiteswap.ball_count(values),
            "landing_residues": VanillaSiteswap.landing_residues(values),
            "valid": VanillaSiteswap.is_valid(values),
        }""")

code("""pattern_text = widgets.Text(value="531", description="pattern")
pattern_output = widgets.Output()


def check_pattern(change=None):
    with pattern_output:
        clear_output(wait=True)
        try:
            report = VanillaSiteswap.report(pattern_text.value)
            for key, value in report.items():
                print(f"{key}: {value}")
            if report["valid"]:
                print("\\nValid vanilla asynchronous siteswap.")
            else:
                print("\\nNOT valid in the simple vanilla asynchronous model.")
        except Exception as e:
            print(f"Pattern error: {e}")


pattern_text.observe(check_pattern, names="value")

display(widgets.VBox([
    widgets.HTML(section_header_html("4. Pattern validator", "Try 333, 531, 441, or invalid strings like 123.")),
    pattern_text,
    pattern_output,
]))
check_pattern()""")

notebook = {
    "nbformat": 4,
    "nbformat_minor": 0,
    "metadata": {
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
    },
    "cells": cells,
}

NB_PATH.write_text(json.dumps(notebook, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {NB_PATH} ({len(cells)} cells)")
