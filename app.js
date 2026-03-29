</> JavaScript

  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional


  const firebaseConfig = {
    apiKey: "AIzaSyD9ThGt8TvsuRnQG1mJa_EaU-b6gj6wsHA",
    authDomain: "next-film-star.firebaseapp.com",
    projectId: "next-film-star",
    storageBucket: "next-film-star.firebasestorage.app",
    messagingSenderId: "1059788613499",
    appId: "1:1059788613499:web:0130f6942b86175a96ffde",
    measurementId: "G-DP3PJJFKKF"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);


firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const appDiv = document.getElementById("app");

const paymentLinks = {
  5: "https://buy.stripe.com/4gM9AT3F6feK59k6IWdAk07",
  10: "https://buy.stripe.com/3cIfZha3u3w21X8c3gdAk08",
  25: "https://buy.stripe.com/28E5kDdfG5EaatEd7kdAk09",
  50: "https://buy.stripe.com/7sY9AT1wY4A61X87N0dAk0a,
  100: "https://buy.stripe.com/6oU8wP3F68Qm59kaZcdAk0b",
  250: "https://buy.stripe.com/4gMcN52B27MiatE9V8dAk0c"
};

function render(contestants) {
  appDiv.innerHTML = "";

  contestants.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <h2>${c.name}</h2>
      <img src="${c.image}" />
      <p>Votes: ${c.votes}</p>
      <button onclick="vote('${c.id}')">Free Vote</button>
    `;

    [5,10,25,50,100,250].forEach(v => {
      const btn = document.createElement("button");
      btn.innerText = `${v} Votes - $${v}`;
      btn.onclick = () => {
        window.location.href = paymentLinks[v] + "?client_reference_id=" + c.id;
      };
      div.appendChild(btn);
    });

    appDiv.appendChild(div);
  });
}

// LIVE DATA
db.collection("contestants").onSnapshot(snapshot => {
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  render(data.sort((a,b)=>b.votes-a.votes));
});

// FREE VOTE
function vote(id) {
  const last = localStorage.getItem("lastVote");
  const today = new Date().toDateString();

  if (last === today) {
    alert("Already voted today");
    return;
  }

  const ref = db.collection("contestants").doc(id);

  ref.get().then(doc => {
    ref.update({
      votes: (doc.data().votes || 0) + 1
    });
  });

  localStorage.setItem("lastVote", today);
}
⚡ 4. functions/stripe-webho