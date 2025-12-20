
let currentReceiver = null;
let unreadCounts = {}; // track unread message counts per user


const socket = io(window.location.origin);

const token = localStorage.getItem("token");
const myEmail = localStorage.getItem("email");
const userEmailElem = document.getElementById("userEmail");
const receiverInput = document.getElementById("receiverEmail");
const loadChatBtn = document.getElementById("loadChatBtn");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");

//let currentReceiver = null;
async function loadConversations() {
  const [usersRes, unreadRes] = await Promise.all([
    fetch(`${window.location.origin}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${window.location.origin}/api/unread`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const users = await usersRes.json();
  const unreadMap = await unreadRes.json();
  const chatList = document.getElementById("chatList");
  chatList.innerHTML = "";

  users.forEach((user) => {
    const li = document.createElement("li");
    li.classList.add("chat-user");
    li.textContent = user;

    // Unread badge
    if (unreadMap[user]) {
      const badge = document.createElement("span");
      badge.classList.add("unread-badge");
      badge.textContent = unreadMap[user];
      li.appendChild(badge);
    }

li.addEventListener("click", () => {
  //receiverInput.value = user;
  currentReceiver = user;

  // Set chat header
  document.getElementById("chatWith").textContent = user;

  // Load chat history
  socket.emit("getMessages", user, (msgs) => {
    messagesDiv.innerHTML = "";
    msgs.forEach((m) =>
      addMessage(m, m.sender === myEmail ? "sent" : "received")
    );
  });

  // Clear unread badge + count
  unreadCounts[user] = 0;
  if (li.querySelector(".unread-badge")) li.querySelector(".unread-badge").remove();
});




    chatList.appendChild(li);
  });
}


if (!token) {
  window.location.href = "index.html";
}

userEmailElem.textContent = myEmail;

// Authenticate this socket
socket.emit("authenticate", token);
loadConversations();



// Handle receiving new messages
socket.on("receiveMessage", (msg) => {
  // If we're currently chatting with this sender
  if (currentReceiver === msg.sender) {
    addMessage(msg, "received");
    // Mark message as read immediately
    fetch(`${window.location.origin}/api/unread`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(loadConversations);
  } else {
    // Not currently chatting — increment unread badge
    unreadCounts[msg.sender] = (unreadCounts[msg.sender] || 0) + 1;
    updateUnreadBadge(msg.sender);
  }
});




// Send message
sendBtn.addEventListener("click", () => {
  const content = messageInput.value.trim();
  if (!content || !currentReceiver) return;

  // Immediately show message in sender's UI
  const msg = {
    sender: myEmail,
    receiver: currentReceiver,
    content,
  };
  addMessage(msg, "sent");

  socket.emit("sendMessage", msg);
  messageInput.value = "";
});


// Add message to UI
function addMessage(msg, type) {
  const div = document.createElement("div");
  div.classList.add("message", type);
  div.textContent = msg.content;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function updateUnreadBadge(email) {
  const chatItems = document.querySelectorAll("#chatList li");
  chatItems.forEach((li) => {
    const user = li.textContent.trim();
    if (user === email) {
      let badge = li.querySelector(".unread-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.classList.add("unread-badge");
        li.appendChild(badge);
      }
      badge.textContent = unreadCounts[email];
    }
  });
}

// Logout
logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});
