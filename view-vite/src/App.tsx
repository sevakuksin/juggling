import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DemoPageRoute } from "@/pages/DemoPage";
import { HomePage } from "@/pages/HomePage";

// Strip trailing slash so basename works at both "/" (dev) and "/juggling/" (Pages).
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/demo/:slug" element={<DemoPageRoute />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
