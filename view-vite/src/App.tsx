import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DemoPageRoute } from "@/pages/DemoPage";
import { HomePage } from "@/pages/HomePage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/demo/:slug" element={<DemoPageRoute />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
