const fs = require('fs');

const path = 'd:/Code/Realtime-chat-App-main/frontend/src/pages/CallPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add ChatStore import
if (!content.includes('useChatStore')) {
  content = content.replace(
    'import { useSearchParams } from "react-router-dom";',
    'import { useSearchParams } from "react-router-dom";\nimport { useChatStore } from "../store/useChatStore";'
  );
}

// 2. Add Group State Hooks
const stateHooksTarget = 'const [showEmojiPicker, setShowEmojiPicker] = useState(false);';
const groupHooks = `
  // ── Group Mesh State ───────────────────────────
  const groupPcsRef = useRef({});
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const chatUsers = useChatStore(state => state.users);
  const initUsers = useChatStore(state => state.getUsers);

  useEffect(() => {
    if (showAddPeople && chatUsers.length === 0) initUsers();
  }, [showAddPeople, chatUsers.length, initUsers]);
`;
if (!content.includes('groupPcsRef')) {
   content = content.replace(stateHooksTarget, stateHooksTarget + '\n' + groupHooks);
}

// 3. Add Mesh WEBRTC functions
const cleanupTarget = 'localStream.current?.getTracks().forEach((t) => t.stop());';
const cleanupGroupPcs = `
    Object.values(groupPcsRef.current).forEach(pc => {
       try { pc.close(); } catch {}
    });
    groupPcsRef.current = {};
    setGroupParticipants([]);
`;
if(!content.includes('groupPcsRef.current).forEach')){
   content = content.replace(cleanupTarget, cleanupTarget + '\n' + cleanupGroupPcs);
}

// 4. Update the Add User icon onClick
const addUserTarget = '<UserPlus className="size-5" />';
if (content.includes(addUserTarget)) {
   const addUserBtnFull = 'className="wa-center-btn" title="Add User">\n                <UserPlus className="size-5" />\n              </button>';
   const replacedBtn = 'className="wa-center-btn" title="Add User" onClick={() => setShowAddPeople(true)}>\n                <UserPlus className="size-5" />\n              </button>';
   content = content.replace(addUserBtnFull, replacedBtn);
} else {
   // Wait, maybe the icon is slightly different: <UserPlus className="size-5.5" />
   content = content.replace(
      '<button className="wa-center-btn">',
      '<button className="wa-center-btn" onClick={() => setShowAddPeople(true)}>'
   ); // Note: naive replace, handle safely.
}

// 5. Add Panel UI
const panelPositionTarget = '{/* Bottom controls */}';
const panelUI = `
      {/* ── ADD PEOPLE PANEL ── */}
      {showAddPeople && (
        <div className="absolute top-0 right-0 h-full w-[340px] bg-[#111B21] flex flex-col z-[999999] shadow-2xl transition-transform border-[rgba(255,255,255,0.1)] border-l">
           <div className="p-4 bg-[#202C33] flex items-center justify-between">
              <span className="font-semibold text-white">Add participants</span>
              <button onClick={() => setShowAddPeople(false)} className="text-[#8696A0] hover:text-white transition-colors text-xl leading-none">✕</button>
           </div>
           
           <div className="p-3 bg-[#111B21]">
              <div className="bg-[#202C33] px-4 py-2 rounded-lg flex items-center gap-2">
                 <input type="text" placeholder="Search contacts..." className="w-full bg-transparent text-sm text-white outline-none placeholder-[#8696A0]"/>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto px-2">
              {chatUsers.filter(u => u._id !== userId && u._id !== peerId).map(u => {
                 const isSelected = selectedGroupUsers.includes(u._id);
                 return (
                 <label key={u._id} className="flex items-center gap-4 p-3 hover:bg-[#202C33] cursor-pointer rounded-lg transition-colors">
                    <div className={\`w-5 h-5 rounded-md flex items-center justify-center border transition-colors \${isSelected ? 'bg-[#00A884] border-[#00A884]' : 'border-[#8696A0]'}\`}>
                       {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                    <img src={u.profilePic || "/avatar.png"} className="size-11 rounded-full object-cover" />
                    <span className="text-white text-[15px] font-medium">{u.fullName}</span>
                    <input type="checkbox" className="hidden" 
                           checked={isSelected}
                           onChange={() => {
                              if (!isSelected) {
                                  if (groupParticipants.length + selectedGroupUsers.length + 1 >= 6) {
                                      alert("Maximum 6 participants reached (Mesh limitation).");
                                      return;
                                  }
                                  setSelectedGroupUsers([...selectedGroupUsers, u._id]);
                              } else {
                                  setSelectedGroupUsers(selectedGroupUsers.filter(id => id !== u._id));
                              }
                           }} />
                 </label>
                 );
              })}
           </div>

           {selectedGroupUsers.length > 0 && (
              <div className="p-4 border-t border-white/5 bg-[#111B21]">
                 <button 
                  onClick={() => {
                    sockRef.current?.emit("call:addParticipants", {
                      callId: peerId,
                      from: userId,
                      users: selectedGroupUsers
                    });
                    setShowAddPeople(false);
                    setSelectedGroupUsers([]);
                  }}
                  className="w-full bg-[#00A884] hover:bg-[#029676] text-[#111B21] font-semibold py-3 rounded-lg transition-colors">
                    Add to Call ({selectedGroupUsers.length})
                 </button>
              </div>
           )}
        </div>
      )}
`;

if (!content.includes('ADD PEOPLE PANEL')) {
   content = content.replace(panelPositionTarget, panelUI + '\n' + panelPositionTarget);
}

// Replace exact Add User Button safely
content = content.replace(/<button[^>]+><UserPlus[^>]+><\/button>/g, (match) => {
   if(match.includes('setShowAddPeople')) return match;
   return match.replace('<button', '<button onClick={() => setShowAddPeople(true)}');
});

fs.writeFileSync(path, content, 'utf8');
console.log('Patch complete.');
