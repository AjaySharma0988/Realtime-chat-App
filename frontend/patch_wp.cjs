const fs = require('fs');

const path = 'd:/Code/Realtime-chat-App-main/frontend/src/pages/CallPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Inject Watch Party states
if (!content.includes('isWatchParty')) {
   const stateHooksTarget = 'const [groupParticipants, setGroupParticipants] = useState([]);';
   const wpState = `  const [isWatchParty, setIsWatchParty] = useState(false);\n  const [wpUrl, setWpUrl] = useState("");`;
   content = content.replace(stateHooksTarget, stateHooksTarget + '\n' + wpState);
}

// 2. Inject Socket sync for Watch party
if (!content.includes('"call:watchPartyToggle"')) {
   const socketSyncTarget = 'sock.on("call:mediaStatus"';
   const wpSocket = `
    sock.on("call:watchPartyToggle", ({ enabled }) => {
      setIsWatchParty(enabled);
    });
`;
   content = content.replace(socketSyncTarget, wpSocket + '\n    ' + socketSyncTarget);
}

// 3. Inject Backend Socket logic (via socket.js) - We'll just put standard emit in script below
const backendPath = 'd:/Code/Realtime-chat-App-main/backend/src/lib/socket.js';
let backendContent = fs.readFileSync(backendPath, 'utf8');
if (!backendContent.includes('call:watchPartyToggle')) {
   backendContent = backendContent.replace('socket.on("call:group:ice"', `
  socket.on("call:watchPartyToggle", ({ callId, enabled }) => {
    io.to(callId).emit("call:watchPartyToggle", { enabled });
  });

  socket.on("call:group:ice"`);
   fs.writeFileSync(backendPath, backendContent, 'utf8');
}

// 4. Inject structural Wrapper into CallPage.jsx
const headerStart = '<header';
const pageRootClassesTarget = 'className="bg-[#0B141A] w-full h-screen relative overflow-hidden flex flex-col wa-call-window text-white shadow-xl"';
const replacedRootClasses = 'className="bg-black w-full h-screen relative overflow-hidden flex wa-call-window text-white shadow-xl"';

if (content.includes(pageRootClassesTarget)) {
   content = content.replace(pageRootClassesTarget, replacedRootClasses);
   
   // Replace structure
   const [firstPart, restOfFile] = content.split('<header ');
   if(restOfFile) {
       const wrapperHead = `
      {/* ── CENTRAL SPLIT VIEW ── */}
      {/* MEDIA SYSTEM (LEFT) */}
      <div className={\`transition-all duration-500 ease-in-out overflow-hidden flex flex-col bg-[#111B21] z-10 \${isWatchParty ? "w-[75%] opacity-100 border-r-[1px] border-white/5" : "w-0 opacity-0 border-none"}\`}>
         {/* HEADER */}
         <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#2A3942]/50 shadow-sm">
           <div className="flex gap-2">
             <button className="bg-[#1976d2] hover:bg-[#1565c0] text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors"><MonitorPlay className="size-4"/> Screenshare</button>
             <button className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                 <span className="border border-white/50 rounded-sm px-1 leading-tight pb-0.5 text-[10px]">V</span> VBrowser
             </button>
             <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                <File className="size-4"/> File
             </button>
             <button className="bg-white/10 hover:bg-white/20 text-[#D1D7DB] px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                Playlist <span className="bg-[#1976d2] text-white px-2 py-0.5 rounded-full text-[10px]">0</span>
             </button>
           </div>
           <div className="relative w-80">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A0]">
               <svg viewBox="0 0 24 24" height="18" width="18" className="text-[#8696A0]" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M15.009,13.805h-0.636l-0.22-0.219c0.781-0.911,1.256-2.092,1.256-3.386 c0-2.876-2.332-5.207-5.207-5.207c-2.876,0-5.208,2.331-5.208,5.207s2.331,5.208,5.208,5.208c1.293,0,2.474-0.474,3.385-1.255 l0.221,0.22v0.635l4.004,3.999l1.194-1.195L15.009,13.805z M10.201,13.805c-2.203,0-3.99-1.787-3.99-3.991 c0-2.203,1.787-3.99,3.99-3.99c2.204,0,3.99,1.787,3.99,3.99C14.191,12.017,12.405,13.805,10.201,13.805z"></path></svg>
             </div>
             <input type="text" placeholder="Enter video URL, magnet link, YT..." className="w-full bg-[#202C33] text-[15px] font-medium text-[#E9EDEF] rounded-full py-[10px] pl-[38px] pr-4 outline-none border border-white/5 focus:border-white/20 transition-all placeholder-[#8696A0]" value={wpUrl} onChange={(e)=>setWpUrl(e.target.value)} />
           </div>
         </div>
         {/* PLAYER REGION */}
         <div className="flex-1 m-8 flex flex-col bg-black rounded shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative group">
            {/* Fake Content Layer (Yellow Title Reference Screen) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[url('https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80')] bg-cover bg-center brightness-75 sepia-[.3]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-60" />
            
            {/* UI TEXT */}
            <div className="absolute inset-0 flex items-center justify-between px-[10%] drop-shadow-2xl font-black text-[#F4D03F] opacity-90 leading-none tracking-tight" style={{ fontFamily: 'Impact, sans-serif' }}>
               <div className="text-center transform -rotate-2">
                 <div className="text-2xl text-white drop-shadow-md">WRITTEN BY</div>
                 <div className="text-5xl mt-1">VIR DAS</div>
                 <div className="text-5xl">AMOGH RANADIVE</div>
               </div>
               <div className="text-center transform 2">
                 <div className="text-2xl text-white drop-shadow-md">लेखक</div>
                 <div className="text-5xl mt-1">वीर दास</div>
                 <div className="text-5xl">अमोग रणदीवे</div>
               </div>
            </div>

            {/* FAKE ARROWS */}
            <div className="absolute top-1/2 -mt-6 right-0 bg-[#1976d2] px-2 py-3 rounded-l-md text-white shadow-xl cursor-pointer">›</div>
            <div className="absolute top-4 right-1/2 bg-white/10 px-2 py-1 rounded cursor-pointer gap-2 flex items-center hover:bg-white/20 text-white/70">
                <span className="size-4 border rounded-sm"></span>
                <span className="font-bold text-xs">⏭</span>
            </div>

            {/* PLAYER CONTROLS (Hover) */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               {/* Progress Line */}
               <div className="w-full h-1 bg-white/20 relative cursor-pointer group/prog">
                  <div className="absolute left-0 top-0 bottom-0 min-w-1 bg-[#1976d2] w-[95%]" />
                  <div className="absolute left-[95%] top-1/2 -mt-1.5 -ml-1.5 size-3 bg-white rounded-full shadow blur-[px] scale-0 group-hover/prog:scale-100 transition-transform" />
               </div>
               {/* Control Bar */}
               <div className="flex-1 flex items-center px-4 gap-4 text-white text-[13px] tracking-wide">
                  <button className="text-xl">▶</button>
                  <button className="bg-white/20 hover:bg-[#1976d2] transition-colors leading-none font-bold text-[10px] uppercase px-2 py-1 rounded-sm">Sync</button>
                  <span className="tabular-nums opacity-90 tracking-wider">1:51:33</span>
                  <div className="flex-1"/>
                  <span className="tabular-nums opacity-90 tracking-wider">1:56:30</span>
                  <span className="opacity-70 font-semibold mx-1">1.00x</span>
                  <button className="opacity-80 hover:opacity-100 mx-1 text-lg">🔁</button>
                  <button className="opacity-80 hover:opacity-100 font-bold tracking-wider mx-1 rounded border border-white/40 px-1 text-[10px]">CC</button>
                  <button className="opacity-80 hover:opacity-100 text-lg mx-1">🔲</button>
                  <button className="opacity-80 hover:opacity-100 text-lg mx-1">🔈</button>
               </div>
            </div>
         </div>
      </div>

      {/* CALL SYSTEM (RIGHT or FULL) */}
      <div className={\`transition-all duration-500 ease-in-out relative flex flex-col bg-[#0B141A] \${isWatchParty ? "w-[25%] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20" : "w-full"}\`}>
         <div className={\`absolute inset-0 flex flex-col overflow-hidden \${isWatchParty ? "watch-party-active" : ""}\`}>
            <header `;

       content = firstPart + wrapperHead + restOfFile.split('      <div className="relative w-full h-full flex-1 bg-[#0B141A]">').join('      <div className="relative w-full flex-1 p-0 flex flex-col watch-party-flex-wrap">');
       
       // Close the wrapper
       content = content.replace('</footer>\n    </div>', '</footer>\n         </div>\n      </div>\n    </div>');

       // Bind the new icon to the footer
       const footerSplit = content.split('wa-center-btn" title="Add User"');
       if(footerSplit.length > 1) {
           content = footerSplit[0] + 'wa-center-btn" title="Add User"' + footerSplit[1];
           
           // Inject button BEFORE AddUser
           const addWpBtn = `
              <button 
                onClick={() => {
                   const next = !isWatchParty;
                   setIsWatchParty(next);
                   sockRef.current?.emit("call:watchPartyToggle", { callId: peerId, enabled: next });
                }} 
                className={\`wa-center-btn transition-colors \${isWatchParty ? 'bg-[#1976d2] text-white hover:bg-[#1565c0]' : ''}\`} 
                title="Watch Party"
              >
                 <MonitorPlay className="size-5" />
              </button>
           `;
           content = content.replace('onClick={() => setShowAddPeople(true)}', 'onClick={() => setShowAddPeople(true)}');
           
           // We will target the UserPlus button rendering exactly to place it BEFORE.
           content = content.replace(/<button[^>]+title="Add User">/g, addWpBtn + "\n$&");
           content = content.replace(/<button[^>]+title="Add User"[^>]*>/g, addWpBtn + "\n$&");
       }
   }
}

fs.writeFileSync(path, content, 'utf8');

// 5. Inject CSS for .watch-party-active layout morphing directly via CSS overrides
const cssPath = 'd:/Code/Realtime-chat-App-main/frontend/src/pages/callWindow.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');

if (!cssContent.includes('.watch-party-active .video-main')) {
   const cssOverrides = `

/* WATCH PARTY RESPONSIVE FLUID MORPHS */
.watch-party-active .video-main,
.watch-party-active .video-pip,
.watch-party-active .group-grid-cell {
   position: relative !important;
   inset: auto !important;
   top: auto !important;
   right: auto !important;
   width: 100% !important;
   height: auto !important;
   aspect-ratio: 16/9;
   border-radius: 12px !important;
   margin-bottom: 8px !important;
   box-shadow: none !important;
   border: 1px solid rgba(255,255,255,0.05) !important;
   overflow: hidden;
}

.watch-party-active .status-icon-pip,
.watch-party-active .status-icon-main {
   position: absolute !important;
   bottom: 8px !important;
   left: 8px !important;
   transform: scale(0.85);
   transform-origin: left bottom;
}

.watch-party-flex-wrap {
   padding: 12px !important;
   height: auto !important;
}

.watch-party-active .watch-party-flex-wrap > div,
.watch-party-active .watch-party-flex-wrap > .relative {
   display: flex !important;
   flex-direction: column !important;
   gap: 0px !important;
   padding: 0 !important;
}

.watch-party-active .grid {
   display: flex !important;
   flex-direction: column !important;
   grid-template-columns: none !important;
}

.watch-party-active footer {
   height: auto !important;
   padding: 16px 12px 24px 12px !important;
   margin-bottom: 0px !important;
   flex-wrap: wrap !important;
   justify-content: center !important;
   gap: 8px !important;
}

.watch-party-active header {
   position: relative !important;
   padding: 12px !important;
   background: transparent !important;
}
`;
   fs.writeFileSync(cssPath, cssContent + cssOverrides, 'utf8');
}

console.log('Watch Party Patch complete.');
