import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

vi.mock("next/navigation", async () => {
  const { router, navigationState } = await import("./src/test/navigation");
  return {
    useRouter: () => router,
    usePathname: () => navigationState.pathname,
    useSearchParams: () => navigationState.searchParams,
    useParams: () => ({}),
    redirect: vi.fn(),
  };
});

afterEach(async () => {
  const { router, setSearchParams } = await import("./src/test/navigation");
  Object.values(router).forEach((fn) => fn.mockReset());
  setSearchParams("");
});
