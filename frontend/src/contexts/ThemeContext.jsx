import { createContext, useContext } from "react";
import { useThemeStore } from "../store/useThemeStore";

const ThemeContext = createContext();

const themes = {
  dark: {
    panel: "#111b21",
    background: "#0b141a",
    text: "#e9edef",
    iconDefault: "#8696A0",
    iconHover: "#E9EDEF",
    border: "rgba(255,255,255,0.05)"
  },
  light: {
    panel: "#f0f2f5",
    background: "#ffffff",
    text: "#111b21",
    iconDefault: "#54656F",
    iconHover: "#111b21",
    border: "rgba(0,0,0,0.05)"
  }
};

export const ThemeProvider = ({ children }) => {
  const { theme } = useThemeStore();
  
  // DaisyUI light-equivalent themes
  const lightThemes = [
    "light", "cupcake", "bumblebee", "emerald", "corporate", 
    "retro", "valentine", "garden", "aqua", "lofi", 
    "pastel", "fantasy", "wireframe", "cmyk", "autumn", 
    "lemonade", "winter", "nord"
  ];
  
  const isLight = lightThemes.includes(theme);
  const currentTokens = isLight ? themes.light : themes.dark;

  return (
    <ThemeContext.Provider value={{ tokens: currentTokens, isLight }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
