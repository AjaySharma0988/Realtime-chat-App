export const updateFaviconBadge = (count) => {
  const favicon = document.getElementById("favicon");
  if (!favicon) return;

  // Resolve colors from theme
  const getThemeColors = () => {
    const temp = document.createElement("div");
    
    // Get Primary
    temp.style.color = "oklch(var(--p))";
    document.body.appendChild(temp);
    const primary = window.getComputedStyle(temp).color;
    
    // Get Base-300 (Background)
    temp.style.color = "oklch(var(--b3))";
    const bg = window.getComputedStyle(temp).color;
    
    document.body.removeChild(temp);
    return { primary, bg };
  };

  const { primary, bg } = getThemeColors();

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // 1. Draw Background (matching TopBar bg-base-300)
  ctx.fillStyle = bg;
  // Draw rounded rectangle
  const radius = 16;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(64 - radius, 0);
  ctx.quadraticCurveTo(64, 0, 64, radius);
  ctx.lineTo(64, 64 - radius);
  ctx.quadraticCurveTo(64, 64, 64 - radius, 64);
  ctx.lineTo(radius, 64);
  ctx.quadraticCurveTo(0, 64, 0, 64 - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // 2. Draw MessageSquare Icon
  ctx.save();
  ctx.translate(8, 8); 
  ctx.scale(2, 2);    
  
  const p = new Path2D("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
  
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = primary;
  ctx.globalAlpha = 0.7; // Match TopBar opacity-70
  ctx.lineWidth = 2;
  ctx.stroke(p);
  ctx.restore();

  // 3. Draw Notification Dot if count > 0
  if (count > 0) {
    ctx.beginPath();
    ctx.arc(52, 12, 10, 0, 2 * Math.PI);
    ctx.fillStyle = primary;
    ctx.globalAlpha = 1.0;
    ctx.fill();
    ctx.strokeStyle = bg; // Use theme bg for border to make it pop
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  favicon.href = canvas.toDataURL("image/png");
};
