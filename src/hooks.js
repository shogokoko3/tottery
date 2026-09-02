import { useEffect, useState } from "react";

export function useWindowWidth() {
  let [e, t] = (0, useState)(() =>
    typeof window < "u" ? window.innerWidth : 400,
  );
  return (
    (0, useEffect)(() => {
      let l = () => t(window.innerWidth);
      return (
        window.addEventListener("resize", l),
        window.addEventListener("orientationchange", l),
        () => {
          (window.removeEventListener("resize", l),
            window.removeEventListener("orientationchange", l));
        }
      );
    }, []),
    e
  );
}
