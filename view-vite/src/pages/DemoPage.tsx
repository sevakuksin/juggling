import { Navigate, useParams } from "react-router-dom";
import { DemoHeader } from "@/components/Layout";
import { demoByPath, type DemoDefinition } from "@/demos/registry";

function DemoPage({ demo }: { demo: DemoDefinition }) {
  const Component = demo.component;
  return (
    <div className="demo-page">
      <DemoHeader num={demo.num} title={demo.pageTitle} subtitle={demo.pageSubtitle} />
      <Component />
    </div>
  );
}

export function DemoPageRoute() {
  const { slug } = useParams<{ slug: string }>();
  const demo = slug ? demoByPath(slug) : undefined;
  if (!demo) return <Navigate to="/" replace />;
  return <DemoPage demo={demo} />;
}
