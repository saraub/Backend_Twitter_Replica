const { db, admin } = require("../util/admin");
const config = require("../util/config");
const firebase = require("firebase");
const {
  validateSingup,
  validateLogindata,
  reduceUserDetails,
} = require("../util/valudators");
firebase.initializeApp(config);

exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };
  const { valid, errors } = validateSingup(newUser);
  if (!valid) return res.status(400).json(errors);
  const noImg = "no-img.png";

  let token, userId;
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then((data) => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
        createdat: new Date().toISOString(),
        userId,
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((error) => {
      console.error(err);
      if ((err, code === "auth/email-already-in-use")) {
        return res.status(400).json({ email: "email is already in use" });
      } else {
        return res.status(500).json({ general:'something went wrong,please try again' });
      }
    });
};
exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  const { valid, errors } = validateLogindata(user);
  if (!valid) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((error) => {
      console.error(error);
      return res.status(500).json({ error: error.code });
    });
};
exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.user.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection("likes")
          .where("userHandle", "==", "req.user.handle")
          .get();
      }
    })
    .then((data) => {
      userData.likes = [];
      data.forEach((doc) => {
        userData.likes.push(doc.data());
      });
      return db
        .collection("notifications")
        .where("recipient", "==", req.user.handle)
        .orderBy("createdat", "desc")
        .limit(10)
        .get();
    }).then(data=>{
      userData.notifications=[];
      data.forEach(doc=>{
        userData.notifications.push({
          recipient:doc.data().recipient,
          sender:doc.data().sender,
          createdat:doc.data().createdat,
          read:doc.data().read,
          type:doc.data().type,
          screamId:doc.data().screamId,
          notificationId=doc.id,

        })
      });
      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: error.code });
    });
};

exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req, body);
  db.doc(`users/${req.user.handle}`)
    .update(userDetails)
    .then(() => {
      return res.json({ message: "Details added successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: error.code });
    });
};

exports.uploadImage = (req, res) => {
  const Busboy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new Busboy({ headers: req.headers });
  console.log(fieldname);
  console.log(filename);
  console.log(minetype);
  let imageFileName;
  let imageToBeUploaded = {};
  busboy.on("file", (fieldname, file, filename, encoding, minetype) => {
    if (minetype !== "image/jpeg" && minetype !== "image/png") {
      return res.status(400).json({ error: "Wrong file type submitted" });
    }
    const imageExtention = filename.split(".")[filename.split(".").length - 1];
    imageFileName = `${Math.round(Math.random() * 10000000)}.${imageExtention}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, minetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.minetype,
          },
        },
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`users/${req.user.handle}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ message: "iamge uplaoded successfully" });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: error.code });
      });
  });
  busboy.end(req.rawBody);
};
exports.getUserDetails=(req,res)=>{
  let userData={};
  db.doc(`/users/${req.params.handle}`).get().then(doc=>{
    if(doc.exists){
      userData.user=doc.data();
      return db.collection('screams').where('userHandle','==',req.params.handle).orderBy('createdat','desc').get();

    }else{
      return res.status(404).json({error:'user not found'});
    }

  }).then(data=>{
    userData.screams=[];
    data.forEach(doc=>{
      userData.screams.push({
        body:doc.data().body,
        createdat:doc.data().createdat,
        userHandle:doc.data().userHandle,
        userImage:doc.data().userImage,
        likeCount:doc.data().likeCount,
        commentCount:doc.data().commentCount,
        screamId=doc.id,
      })
    });
    return res.json(userData);
  }).catch(err=>{
    console.error(err);
    return res.status(500).json({error:err.code});
  })
};
exports.markNotificationsRead=(req,res)=>{
  let batch=db.batch();
  req.body.forEach(notificationId=>{
    const notification=db.doc(`/notifications/${notificationId}`);
    batch.update(notification,{read:true});
  });
  batch.commit().then(()=>{
    return res.json({message:'notification marked as read'});
  })
  .catch(err=>{
    console.error(err);
    return res.status(500).json({error:err.code});
  })
};