import React from "react";
import { getProfilePicUrl } from "../lib/utils";

/**
 * StatusAvatar — profile picture with a teal/segmented status ring.
 * Refined to match the provided high-fidelity reference image.
 */
const StatusAvatar = ({ user, size = "size-12", statusCount = 0, isOnline = false, onClick }) => {
  const hasStatus = statusCount > 0;
  
  // Logic for segments
  const renderRing = () => {
    if (!hasStatus) return null;

    // Standard WhatsApp Teal color from reference
    const statusTeal = "#00a884";

    if (statusCount === 1) {
      return (
        <div 
          className="absolute inset-[-4px] rounded-full border-[2px]"
          style={{ 
            borderColor: statusTeal,
            zIndex: 1, // Stay above background but below hover effects if any
            pointerEvents: "none"
          }}
        />
      );
    }

    // Multi-segment ring using SVG for precise gaps
    const radius = 50;
    const stroke = 6; // Thinner stroke for a more premium look
    const normalizedRadius = radius - 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const gapDegrees = 4; // gap between segments
    const totalGapCircumference = (gapDegrees * statusCount * circumference) / 360;
    const segmentLength = (circumference - totalGapCircumference) / statusCount;

    return (
      <svg 
        viewBox="0 0 100 100" 
        className="absolute inset-[-5px] size-[calc(100%+10px)] -rotate-90"
        style={{ zIndex: 1, pointerEvents: "none" }}
      >
        {Array.from({ length: statusCount }).map((_, i) => (
          <circle
            key={i}
            stroke={statusTeal}
            strokeWidth={stroke}
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-i * (circumference / statusCount)}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx="50"
            cy="50"
          />
        ))}
      </svg>
    );
  };

  const profileSrc = getProfilePicUrl(user);

  return (
    <div className={`relative flex-shrink-0 ${size}`}>
      {renderRing()}
      <img
        src={profileSrc}
        alt={user.fullName}
        onClick={(e) => {
          if (hasStatus && onClick) {
            e.stopPropagation();
            onClick(user._id);
          }
        }}
        className={`w-full h-full rounded-full object-cover border-[3px] border-transparent p-[1px] ${
          hasStatus 
            ? "cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ring-2 ring-transparent ring-offset-2 ring-offset-base-100" 
            : ""
        }`}
        style={{
           // The "offset" effect is created by the combination of ring-offset and border-transparent
           boxShadow: hasStatus ? "0 0 0 2px oklch(var(--b1))" : "none"
        }}
      />
      {isOnline && (
        <span 
          className="absolute bottom-[1px] right-[1px] size-3 bg-success rounded-full ring-2 ring-base-100 z-10" 
          title="Online"
        />
      )}
    </div>
  );
};

export default StatusAvatar;
