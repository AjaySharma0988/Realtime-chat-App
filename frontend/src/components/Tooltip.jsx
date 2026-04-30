import React from "react";

const Tooltip = ({ text, children, position = "bottom" }) => {
  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "bottom-full mb-1.5 left-1/2 -translate-x-1/2";
      case "bottom":
        return "top-full mt-1.5 left-1/2 -translate-x-1/2";
      case "left":
        return "right-full mr-1.5 top-1/2 -translate-y-1/2";
      case "right":
        return "left-full ml-1.5 top-1/2 -translate-y-1/2";
      default:
        return "top-full mt-1.5 left-1/2 -translate-x-1/2";
    }
  };

  return (
    <div className="group/os-tooltip relative flex items-center justify-center">
      {children}
      <div
        className={`absolute ${getPositionClasses()} opacity-0 group-hover/os-tooltip:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] whitespace-nowrap bg-[#1e2029] text-white text-[13px] px-2.5 py-1 border border-white/90 shadow-xl font-medium tracking-wide rounded-sm`}
      >
        {text}
      </div>
    </div>
  );
};

export default Tooltip;
