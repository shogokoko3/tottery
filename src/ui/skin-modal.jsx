import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const openDialogs = [];
let oldOverflow, oldInert;
export function SkinModal({ label, onClose, children, className = "" }) {
  const ref = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const element = ref.current,
      focusBefore = document.activeElement;
    const root = document.getElementById("root");
    if (!openDialogs.length) {
      oldOverflow = document.body.style.overflow;
      oldInert = root?.inert;
      document.body.style.overflow = "hidden";
      if (root) root.inert = true;
    }
    if (openDialogs.length) openDialogs[openDialogs.length - 1].inert = true;
    openDialogs.push(element);
    element.focus();
    const key = (e) => {
      if (openDialogs[openDialogs.length - 1] !== element) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const buttons = [
        ...element.querySelectorAll(
          'button:not(:disabled), a[href], select, input, [tabindex="0"]',
        ),
      ];
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    element.addEventListener("keydown", key);
    return () => {
      element.removeEventListener("keydown", key);
      openDialogs.splice(openDialogs.indexOf(element), 1);
      if (openDialogs.length) openDialogs[openDialogs.length - 1].inert = false;
      else {
        document.body.style.overflow = oldOverflow;
        if (root) root.inert = !!oldInert;
      }
      if (focusBefore?.isConnected) focusBefore.focus();
    };
  }, []);
  return createPortal(
    <div className={`skin-overlay ${className}`}>
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="skin-dialog"
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}

export function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduce;
}
