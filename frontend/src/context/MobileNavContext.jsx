import { createContext, useContext } from "react";

const MobileNavContext = createContext({ openMobileMenu: () => {} });

export function MobileNavProvider({ openMobileMenu, children }) {
  return <MobileNavContext.Provider value={{ openMobileMenu }}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}
