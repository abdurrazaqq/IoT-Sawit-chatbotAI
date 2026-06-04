import { useEffect, useState } from "react";

export default function AnimNum({ value, decimals = 2 }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDisplay(value), 50);
    return () => window.clearTimeout(timer);
  }, [value]);

  return <span style={{ transition: "all 0.4s ease" }}>{Number(display || 0).toFixed(decimals)}</span>;
}
