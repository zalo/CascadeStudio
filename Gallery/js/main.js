// Initialize Firebase in General
firebase.initializeApp({
  apiKey: "AIzaSyBxJH3SLxUnG0wiZsSRSHiiAFMoEjadoCk",
  authDomain: "cascade-studio-gallery.firebaseapp.com",
  databaseURL: "https://cascade-studio-gallery.firebaseio.com",
  projectId: "cascade-studio-gallery",
  storageBucket: "cascade-studio-gallery.appspot.com",
  messagingSenderId: "436110758694",
  appId: "1:436110758694:web:1873f6d5aa4649fbe927e7"
});

// Get a reference to the database object
var db         = firebase.firestore();
// Get a reference to the storage object
var storage    = firebase.storage();
var storageRef = storage.ref();

// FirebaseUI config.
var uiConfig = {
  //signInFlow: 'popup',
  signInSuccessUrl: window.location.href,
  signInOptions: [{
      provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      clientId: '436110758694-i89nnh4edgholaaskaaab6ik3tq1laf7.apps.googleusercontent.com'
  }],
  // Required to enable one-tap sign-up credential helper.
  credentialHelper: firebaseui.auth.CredentialHelper.GOOGLE_YOLO,
  // tosUrl and privacyPolicyUrl accept either url string or a callback function.
  // Terms of service and privacy policy url/callback.
  tosUrl:           window.location.origin + "/Gallery/Terms",
  privacyPolicyUrl: window.location.origin + "/Gallery/Terms"
};

var onLoadUserProfile = [];
initApp = function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      // User is signed in.
      console.log(user);

      // Render the signout button
      document.getElementById("firebaseui-auth-container").innerHTML = "";

      // Check status of user Profile
      db.collection("users").doc(user.uid)
        .get().then(function (userProfile) {
          let userProfileData = null;
          if (userProfile.exists) {
            userProfileData = userProfile.data();
          } else {
            console.log("No such Profile!  Adding now...")
            userProfileData = {
              username: user.email.split("@")[0],
              avatar: user.photoURL,
              projects: [],
              summary: "",
            };
            db.collection("users").doc(user.uid).set(userProfileData);
          }

          onLoadUserProfile.forEach((callback) => callback(userProfileData, user));
          //console.log(userProfileData);

          let signout = document.createElement("button");
          signout.innerText = "Sign Out " + userProfileData.username;
          signout.onclick = () => {
            firebase.auth().signOut();
            document.getElementById("firebaseui-auth-container").removeChild(signout);
            window.location.reload();
            ui.disableAutoSignIn();
          };
          signout.className = "inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 ml-4";
          document.getElementById("firebaseui-auth-container").appendChild(signout);

        }).catch(function (error) {
          console.log("Error getting document:", error)
        });

    } else {
      // User is signed out.
      // Initialize the FirebaseUI Widget using Firebase.
      var ui = new firebaseui.auth.AuthUI(firebase.auth());
      ui.disableAutoSignIn(); // Doesn't seem to work?
      // The start method will wait until the DOM is loaded.
      ui.start('#firebaseui-auth-container', uiConfig);
    }
  }, function (error) {
    console.log(error);
  });
};

var headerHTML = `
<!-- Top Nav Bar-->
<nav class="flex items-center justify-between flex-wrap bg-gray-900 p-3">
  <a href="/Gallery">
    <div class="flex items-center flex-shrink-0 mr-6">
      <svg class="fill-current h-8 w-8 mr-2" width="54" height="54" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 22.1c1.8-7.2 6.3-10.8 13.5-10.8 10.8 0 12.15 8.1 17.55 9.45 3.6.9 6.75-.45 9.45-4.05-1.8 7.2-6.3 10.8-13.5 10.8-10.8 0-12.15-8.1-17.55-9.45-3.6-.9-6.75.45-9.45 4.05zM0 38.3c1.8-7.2 6.3-10.8 13.5-10.8 10.8 0 12.15 8.1 17.55 9.45 3.6.9 6.75-.45 9.45-4.05-1.8 7.2-6.3 10.8-13.5 10.8-10.8 0-12.15-8.1-17.55-9.45-3.6-.9-6.75.45-9.45 4.05z"/></svg>
      <span class="font-semibold text-xl tracking-tight">Cascade Studio Gallery</span>
    </div>
  </a>
  <div class="w-auto flex items-center lg:w-auto py-1">
    <div class="text-sm flex-grow inline-block">
      <a href="/Gallery"         class="inline-block mt-0 text-gray-200 hover:text-white mr-4">Gallery</a>
      <a href="/"                class="inline-block mt-0 text-gray-200 hover:text-white mr-4">Create</a>
      <a href="/Gallery/EditProfile" class="inline-block mt-0 text-gray-200 hover:text-white" >Edit Profile</a>
    </div>
    <div class="inline-block">
      <a href="#" class="inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 ml-4">Search</a>
    </div>
    <div id="firebaseui-auth-container" class="inline-block"></div>
  </div>
</nav>`;
var footerHTML = `
<footer class="bg-gray-800 p-8 w-full bottom-0">
  <div class="sm:flex mb-4">
    <div class="sm:w-1/4 h-auto mb-5">
      <div class="text-blue-light mb-2">Quick Links</div>
      <ul class="list-reset leading-normal">
        <li class="hover:text-blue-light text-grey-darker"><a href="/Gallery">Gallery Home</a></li>
        <li class="hover:text-blue-light text-grey-darker"><a href="/">Create New Project</a></li>
        <li class="hover:text-blue-light text-grey-darker"><a href="/Gallery/EditProfile">Profile</a></li>
      </ul>
    </div>
    <div class="sm:w-1/4 h-auto">
      <div class="text-orange mb-2">Terms</div>
      <ul class="list-reset leading-normal">
        <li class="hover:text-orange text-grey-darker"><a href="/Gallery/Terms">Terms of Service</a></li>
        <li class="hover:text-orange text-grey-darker"><a href="/Gallery/Terms">Privacy Policy</a></li>
      </ul>
    </div>
  </div>
</footer>`;

window.addEventListener('load', () => {
  document.body.innerHTML = headerHTML + document.body.innerHTML + footerHTML;
  initApp();
});
