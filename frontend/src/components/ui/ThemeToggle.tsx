import { useTheme } from "../../theme";
import Icon from "./Icon";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = `Activar tema ${dark ? "claro" : "oscuro"}`;
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={dark}
      title={label}
    >
      <Icon name={dark ? "sun" : "moon"} size={17} />
      <span>Tema {dark ? "claro" : "oscuro"}</span>
    </button>
  );
}
