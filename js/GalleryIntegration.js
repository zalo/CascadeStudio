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

  // Add the Gallery Upload Window and UI
  document.body.innerHTML += 
`        <div id="gallery-parameters" class="centered shadow-md rounded-lg px-8 pt-6 pb-8 mb-4 flex flex-col my-2" style="display:none;">
            <h1 class="m-2 mb-3 text-3xl">Save Project to Gallery</h1>
            <div class="-mx-3 flex mb-3" style="align-items: center;">
              <div class="md:w-1/2 px-3 mb-3 md:mb-0 inline-block" style="margin-right:8%;">
                <label for="grid-projectname" class="block uppercase tracking-wide text-grey-darker text-xs font-bold mb-2" title="This will appear as the title in the Gallery page.">
                  Project Name
                </label>
                <input id="grid-projectname" type="text" placeholder="Project Name" class="appearance-none block w-full text-gray-800 border border-red rounded py-3 px-4 mb-3">

              </div>
              <img id="grid-thumbnail" class="inline-block rounded" style="max-width: 33%; float: right;" src="/Gallery/img/card-top.jpg" alt="Sunset in the mountains">
            </div>
            <div class="-mx-3 md:flex mb-3">
              <div class="md:w-full px-3">
                <label class="block uppercase tracking-wide text-grey-darker text-xs font-bold mb-2" for="grid-description">
                  Description
                </label>
                <textarea id="grid-description" placeholder="Use this description to tell visitors about about the project" class="appearance-none block w-full h-16 text-gray-800 border border-grey-lighter rounded py-3 px-4 mb-3"></textarea>
              </div>
            </div>
            <div class="-mx-3 md:flex mb-3">
                <div class="md:w-full px-3">
                  <label class="block uppercase tracking-wide text-grey-darker text-xs font-bold mb-2" for="grid-tags">
                    Tags
                  </label>
                  <input id="grid-tags" type="text" placeholder="Space Separated Tags for Search" class="appearance-none block w-full text-gray-800 border border-red rounded py-3 px-4 mb-3">
                </div>
            </div>
            <div class="">
               <div class="inline-block">
                <div class="-mx-3 md:flex mb-2 inline-block">
                    <label for="visibility"  class="inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 m-4 mr-4">Private</label><br>
                    <input type="checkbox" id="grid-visibility" name="visibility" value="Private" style="width: 2rem; height: 2rem;">
                </div>
                <div class="-mx-3 md:flex mb-2 inline-block">
                    <button id="save-button" class="text-lg px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal-500 hover:bg-white mt-0 ml-4">Save</button>
                </div>
              </div>

            </div>
        </div>`;
});

// Manage the showing and hiding of the gallery upload window
var galleryWindowHidden = true;
onLoadUserProfile.push((userProfileData, user, userProfile)=>{
    // Get the Relevant Fields
    let galleryWindow   = document.getElementById("gallery-parameters");
    let nameElem        = document.getElementById("grid-projectname");
    let descriptionElem = document.getElementById("grid-description");
    let previewElem     = document.getElementById("grid-thumbnail");
    let tagsElem        = document.getElementById("grid-tags");
    let visibilityElem  = document.getElementById("grid-visibility");
    // Eventually pre-populate the above fields with defaults from the original database sample if applicable!
    // Save the modifications to those fields with the values from the database
    toggleGalleryUploadWindow = () => {
        // Hide or unhide the gallery parameters window!
        galleryWindowHidden         = !galleryWindowHidden;
        galleryWindow.style.display =  galleryWindowHidden ? 'none' : '';
        let thumbnailURI    = threejsViewport.takeGalleryScreenshotasURI();
        previewElem.src     = thumbnailURI;
        // Save the modifications to those fields with the values from the database
        document.getElementById("save-button").onclick = (event) => {
            // Create the Project Entry in the database
            db.collection("projects").add({
                name        : nameElem       .value,
                description : descriptionElem.value,
                author      : db.collection("users").doc(user.uid),
                author_name : userProfileData.username,
                author_uid  : user           .uid,
                created     : firebase.firestore.FieldValue.serverTimestamp(),
                modified    : firebase.firestore.FieldValue.serverTimestamp(),
                favorites   : [],
                visibility  : visibilityElem.value ? "public" : "private",
            }).then((docRef) => {
                // Add this project to your list of projects
                db.collection("users").doc(user.uid).update({
                    projects: firebase.firestore.FieldValue.arrayUnion(docRef)
                });
                // Upload the Project Contents
                storageRef.child('projects/'+ user.uid +'/'+docRef.id+'.json')
                .putString("data:application/json;utf8," + encodeURIComponent(
                    JSON.stringify(myLayout.toConfig(), null, ' ')), 'data_url')
                .then(function(snapshot) {
                    //console.log('Uploaded project contents to the storage bucket!');
                }).catch(function(error) {
                    console.error("Error uploading project contents: ", error);
                });
                // Upload the Screenshot
                storageRef.child('images/'+ user.uid +'/'+docRef.id+'.png').putString(thumbnailURI, 'data_url')
                .then(function(snapshot) {
                    //console.log('Uploaded screenshot to the storage bucket!');
                }).catch(function(error) {
                    console.error("Error uploading thumbnail: ", error);
                });
                // Hide the Gallery Parameters Window and display victory message!
                galleryWindowHidden         = !galleryWindowHidden;
                galleryWindow.style.display =  galleryWindowHidden ? 'none' : '';
                console.log("Project Saved to the Gallery at: "+window.location.origin + "/?project="+docRef.id);
            })
            .catch(function(error) {
                console.error("Error uploading project: ", error);
            });
        };
    };
});
