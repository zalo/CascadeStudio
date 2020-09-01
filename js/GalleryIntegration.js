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

var onLoadUserProfile = [];
initApp = function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      // User is signed in.
      //console.log(user);
      // Check status of user Profile
      db.collection("users").doc(user.uid)
        .get().then(function (userProfile) {
          let userProfileData = null;
          if (userProfile.exists) {
            userProfileData = userProfile.data();
            onLoadUserProfile.forEach((callback) => callback(userProfileData, user, userProfile));
            let saveToGallery = document.createElement("a");
            saveToGallery.innerText = "Save to Gallery";
            saveToGallery.onclick = () => {
              toggleGalleryUploadWindow();
            };
            //signIn.className = "inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 ml-4";
            document.getElementById("topnav").appendChild(saveToGallery);

            if(signIn){ signIn.remove(); }
          } else {
            console.error("Logged in, but no Profile!  Erroring out...");
            loggedOut();
          }

        }).catch(function (error) {
          console.error("Error getting document:", error);
          loggedOut();
        });
    } else {
      loggedOut();
    }
  }, function (error) {
      console.log(error);
      loggedOut();
  });

  // Add "Sign in at Gallery" Button
  var signIn;
  function loggedOut() {
    signIn = document.createElement("a");
    signIn.innerText = "Sign In at Gallery";
    //signIn.onclick = () => {
      //firebase.auth().signOut();
      //document.getElementById("firebaseui-auth-container").removeChild(signout);
      //window.location.reload();
      //ui.disableAutoSignIn();
    //};
    signIn.href = "./Gallery";
    signIn.target = "_blank";
    //signIn.className = "inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 ml-4";
    document.getElementById("topnav").appendChild(signIn);
  }

};

var galleryProject;


window.addEventListener('load', () => {
  initApp();
  let projectID = new URLSearchParams(window.location.search).get("project");
  if (projectID) {
    db.collection("projects").doc(projectID).get().then((projectEntry) => {
      let authorid = projectEntry.data().author_uid;
      storageRef.child('projects/' + authorid + '/' + projectID + '.json').getDownloadURL().then((url) => {
        fetch(url).then((response) => {
          response.text().then((layout) => {
            galleryProject = layout;
            initialize(); // Reattempt initialization
          });
        });
      });
    });
  }
});
