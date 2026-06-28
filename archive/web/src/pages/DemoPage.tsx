import { Navigate, useParams } from "react-router-dom";
import { DemoHeader } from "../components/Layout";
import { demoByPath, type DemoDefinition } from "../demos/registry";

interface DemoPageProps {
  demo: DemoDefinition;
}

export function DemoPage({ demo }: DemoPageProps) {
  const Component = demo.component;
  return (
    <>
      <DemoHeader num={demo.num} title={demo.pageTitle} subtitle={demo.pageSubtitle} />
      <Component />
    </>
  );
}

export function DemoPageRoute() {
  const { slug } = useParams<{ slug: string }>();
  const demo = slug ? demoByPath(slug) : undefined;
  if (!demo) return <Navigate to="/" replace />;
  return <DemoPage demo={demo} />;
}
