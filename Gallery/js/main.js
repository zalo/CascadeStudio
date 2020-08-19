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
var db      = firebase.firestore();
// Get a reference to the storage object
var storage = firebase.storage();
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
  // Terms of service url/callback.
  tosUrl: '<your-tos-url>',
  // Privacy policy url/callback.
  privacyPolicyUrl: function () {
    window.location.assign('<your-privacy-policy-url>');
  }
};

initApp = function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      // User is signed in.
      console.log(user);

      // Render the signout button
      document.getElementById("firebaseui-auth-container").innerHTML = "";
      let signout = document.createElement("button");
      signout.innerText = "Sign Out " + user.email.split("@")[0];
      signout.onclick = () => { firebase.auth().signOut(); window.location.reload(); };
      signout.className = "inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 ml-4";
      document.getElementById("firebaseui-auth-container").appendChild(signout);

    } else {
      // User is signed out.
      // Initialize the FirebaseUI Widget using Firebase.
      var ui = new firebaseui.auth.AuthUI(firebase.auth());
      // The start method will wait until the DOM is loaded.
      ui.start('#firebaseui-auth-container', uiConfig);
      ui.disableAutoSignIn(); // Doesn't seem to work?
    }
  }, function (error) {
    console.log(error);
  });
};

var headerHTML = `
<!-- Top Nav Bar-->
<nav class="flex items-center justify-between flex-wrap bg-gray-900 p-3">
  <div class="flex items-center flex-shrink-0 mr-6">
    <svg class="fill-current h-8 w-8 mr-2" width="54" height="54" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 22.1c1.8-7.2 6.3-10.8 13.5-10.8 10.8 0 12.15 8.1 17.55 9.45 3.6.9 6.75-.45 9.45-4.05-1.8 7.2-6.3 10.8-13.5 10.8-10.8 0-12.15-8.1-17.55-9.45-3.6-.9-6.75.45-9.45 4.05zM0 38.3c1.8-7.2 6.3-10.8 13.5-10.8 10.8 0 12.15 8.1 17.55 9.45 3.6.9 6.75-.45 9.45-4.05-1.8 7.2-6.3 10.8-13.5 10.8-10.8 0-12.15-8.1-17.55-9.45-3.6-.9-6.75.45-9.45 4.05z"/></svg>
    <span class="font-semibold text-xl tracking-tight">Cascade Studio Gallery</span>
  </div>
  <div class="w-auto flex items-center lg:w-auto py-1">
    <div class="text-sm flex-grow inline-block">
      <a href="/Gallery"         class="inline-block mt-0 text-gray-200 hover:text-white mr-4">Gallery</a>
      <a href="/"                class="inline-block mt-0 text-gray-200 hover:text-white mr-4">Create</a>
      <!--<a href="/Gallery/Profile" class="inline-block mt-0 text-gray-200 hover:text-white"     >Profile</a>-->
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
    <div class="sm:w-1/4 h-auto">
      <div class="text-orange mb-2">Orange</div>
      <ul class="list-reset leading-normal">
          <li class="hover:text-orange text-grey-darker">One</li>
          <li class="hover:text-orange text-grey-darker">Two</li>
          <li class="hover:text-orange text-grey-darker">Three</li>
          <li class="hover:text-orange text-grey-darker">Four</li>
          <li class="hover:text-orange text-grey-darker">Five</li>
          <li class="hover:text-orange text-grey-darker">Six</li>
          <li class="hover:text-orange text-grey-darker">Seven</li>
          <li class="hover:text-orange text-grey-darker">Eight</li>
      </ul>
    </div>
    <div class="sm:w-1/4 h-auto sm:mt-0 mt-8">
      <div class="text-blue mb-2">Blue</div>
      <ul class="list-reset leading-normal">
          <li class="hover:text-blue text-grey-darker">One</li>
          <li class="hover:text-blue text-grey-darker">Two</li>
          <li class="hover:text-blue text-grey-darker">Three</li>
      </ul>

    <div class="text-blue-light mb-2 mt-4">Blue-light</div>
      <ul class="list-reset leading-normal">
          <li class="hover:text-blue-light text-grey-darker">One</li>
          <li class="hover:text-blue-light text-grey-darker">Two</li>
          <li class="hover:text-blue-light text-grey-darker">Three</li>
      </ul>

    </div>
    <div class="sm:w-1/4 h-auto sm:mt-0 mt-8">
            <div class="text-green-dark mb-2">Green-dark</div>
      <ul class="list-reset leading-normal">
          <li class="hover:text-green-dark text-grey-darker">One</li>
          <li class="hover:text-green-dark text-grey-darker">Two</li>
          <li class="hover:text-green-dark text-grey-darker">Three</li>
      </ul>

    <div class="text-green-light mb-2 mt-4">Green-light</div>
      <ul class="list-reset leading-normal">
          <li class="hover:text-green-light text-grey-darker">One</li>
          <li class="hover:text-green-light text-grey-darker">Two</li>
          <li class="hover:text-green-light text-grey-darker">Three</li>
      </ul>
    </div>
    <div class="sm:w-1/2 sm:mt-0 mt-8 h-auto">
        <div class="text-red-light mb-2">Newsletter</div>
        <p class="text-grey-darker leading-normal">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Commodi, consectetur. </p>
        <div class="mt-4 flex">
            <input type="text" class="p-2 border border-grey-light round text-grey-dark text-sm h-auto" placeholder="Your email address">
            <button class="bg-orange text-white rounded-sm h-auto text-xs p-3">Subscribe</button>
        </div>
    </div>

  </div>
</footer>`;

window.addEventListener('load', () => {
  document.body.innerHTML = headerHTML + document.body.innerHTML + footerHTML;
  initApp();
});
