const fs = require('fs');

const path = 'd:/Code/Realtime-chat-App-main/frontend/src/pages/CallPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetRoot = '<div className="fixed inset-0 bg-[#0B141A] flex flex-col overflow-hidden text-white select-none z-[99999] wa-call-window font-sans">';

// Only apply if it hasn't been applied yet
if (content.includes(targetRoot) && !content.includes('CENTRAL SPLIT VIEW')) {
    
    // 1. Replace the root opening div
    content = content.replace(
        targetRoot,
        '<div className="fixed inset-0 bg-black flex overflow-hidden text-white select-none z-[99999] wa-call-window font-sans">'
    );

    // 2. Inject the central split view BEFORE the header
    const headerStart = '{/* Top bar */}';
    
    const wrapperHead = `
      {/* ── CENTRAL SPLIT VIEW ── */}
      {/* MEDIA SYSTEM (LEFT) */}
      <div className={\`transition-all duration-500 ease-in-out overflow-hidden flex flex-col bg-[#111B21] z-10 \${isWatchParty ? "w-[75%] opacity-100 border-r-[1px] border-white/5" : "w-0 opacity-0 border-none"}\`}>
         {/* HEADER */}
         <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#2A3942]/50 shadow-sm pointer-events-auto">
           <div className="flex gap-2">
             <button className="bg-[#1976d2] hover:bg-[#1565c0] text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                Screenshare
             </button>
             <button className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                 <span className="border border-white/50 rounded-sm px-1 leading-tight pb-0.5 text-[10px]">V</span> VBrowser
             </button>
             <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                File
             </button>
             <button className="bg-white/10 hover:bg-white/20 text-[#D1D7DB] px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-colors">
                Playlist <span className="bg-[#1976d2] text-white px-2 py-0.5 rounded-full text-[10px]">0</span>
             </button>
           </div>
           <div className="relative w-80">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A0]">
               <svg viewBox="0 0 24 24" height="18" width="18" className="text-[#8696A0]" fill="currentColor"><path d="M15.009,13.805h-0.636l-0.22-0.219c0.781-0.911,1.256-2.092,1.256-3.386 c0-2.876-2.332-5.207-5.207-5.207c-2.876,0-5.208,2.331-5.208,5.207s2.331,5.208,5.208,5.208c1.293,0,2.474-0.474,3.385-1.255 l0.221,0.22v0.635l4.004,3.999l1.194-1.195L15.009,13.805z M10.201,13.805c-2.203,0-3.99-1.787-3.99-3.991 c0-2.203,1.787-3.99,3.99-3.99c2.204,0,3.99,1.787,3.99,3.99C14.191,12.017,12.405,13.805,10.201,13.805z"></path></svg>
             </div>
             <input type="text" placeholder="Enter video URL, magnet link, YT..." className="w-full bg-[#202C33] text-[15px] font-medium text-[#E9EDEF] rounded-full py-[8px] pl-[38px] pr-4 outline-none border border-white/5 focus:border-white/20 transition-all placeholder-[#8696A0] pointer-events-auto" />
           </div>
         </div>
         {/* PLAYER REGION */}
         <div className="flex-1 m-8 flex flex-col bg-black rounded shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative group pointer-events-auto">
            {/* Fake Content Layer */}
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
`;
    content = content.replace(headerStart, wrapperHead + '\n      ' + headerStart);

    // 3. Close the wrappers. 
    // Wait, let's target the exact string replacing the original "Main area" to "watch-party-flex-wrap"
    const mainAreaTarget = '<div className="relative w-full h-full flex-1 bg-[#0B141A]">';
    const mainAreaReplace = '<div className="relative w-full flex-1 p-0 flex flex-col watch-party-flex-wrap">';
    if (content.includes(mainAreaTarget)) {
        content = content.replace(mainAreaTarget, mainAreaReplace);
    }

    // 4. Close the div correctly at the end.
    // The previously used ending was:
    //     </div>
    //   );
    // };
    content = content.replace(
        '    </div>\n  );\n};\n\nexport default CallPage;',
        '         </div>\n      </div>\n    </div>\n  );\n};\n\nexport default CallPage;'
    );
    
    fs.writeFileSync(path, content, 'utf8');
    console.log('UI Wrapper DOM successfully injected.');
} else {
    console.log('Target root already modified or not found.');
}
