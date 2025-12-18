const socket = io("http://localhost:5000");
const token = localStorage.getItem("token");
const myEmail = localStorage.getItem("email");
const userEmailElem = document.getElementById("userEmail");
const receiverInput = document.getElementById("receiverEmail");
const loadChatBtn = document.getElementById("loadChatBtn");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentReceiver = null;
async function loadConversations() {
  const res = await fetch("http://localhost:5000/api/conversations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const users = await res.json();
  const chatList = document.getElementById("chatList");
  chatList.innerHTML = "";

  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user;
    li.addEventListener("click", () => {
      receiverInput.value = user;
      currentReceiver = user;
      socket.emit("getMessages", user, (msgs) => {
        messagesDiv.innerHTML = "";
        msgs.forEach((m) =>
          addMessage(m, m.sender === myEmail ? "sent" : "received")
        );
      });
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
  addMessage(msg, msg.sender === myEmail ? "sent" : "received");
});

// Load chat history
loadChatBtn.addEventListener("click", () => {
  const receiver = receiverInput.value.trim();
  if (!receiver) return alert("Enter an email to chat with.");
  currentReceiver = receiver;

  socket.emit("getMessages", receiver, (msgs) => {
    messagesDiv.innerHTML = "";
    msgs.forEach((m) => addMessage(m, m.sender === myEmail ? "sent" : "received"));
  });
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

// Logout
logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});
