import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("wouter", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));

import About from "../../client/src/pages/About";
import { MarketingFooter } from "../../client/src/components/MarketingFooter";
import Terms from "../../client/src/pages/Terms";
import Privacy from "../../client/src/pages/Privacy";

const renderWithMemoryRouter = (element: React.ReactNode) => renderToStaticMarkup(element);

describe("about page and marketing footer", () => {
  it("يعرّف قيد كنظام تشغيل مالي ويشرح ملكية CONSEDRA", () => {
    const html = renderWithMemoryRouter(<About />);
    expect(html).toContain("قيد ليست مجرد منصة فواتير");
    expect(html).toContain("نظام التشغيل المالي الذكي للشركات");
    expect(html).toContain("QAYD by CONSEDRA");
    expect(html).toContain("/about");
  });

  it("يعرض صفحتي الشروط والخصوصية مع تنبيه المراجعة القانونية", () => {
    const terms = renderWithMemoryRouter(<Terms />);
    const privacy = renderWithMemoryRouter(<Privacy />);
    expect(terms).toContain("الشروط والأحكام");
    expect(terms).toContain("مسودة تشغيلية");
    expect(privacy).toContain("سياسة الخصوصية");
    expect(privacy).toContain("البيانات التي قد نعالجها");
    expect(privacy).toContain("شركة كونسيدرا القابضة");
    expect(privacy).toContain("info@consedra.com");
    expect(privacy).toContain("2026-08-18");
  });

  it("يعرض التذييل التسويقي وروابط من نحن وتسجيل الدخول", () => {
    const html = renderWithMemoryRouter(<MarketingFooter />);
    expect(html).toContain("كل قيد يقود إلى قرار.");
    expect(html).toContain("QAYD by CONSEDRA");
    expect(html).toContain("/about");
    expect(html).toContain("/login");
    expect(html).toContain("/terms");
    expect(html).toContain("/privacy");
  });
});
