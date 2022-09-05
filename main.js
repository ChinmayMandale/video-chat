// Import the functions you need from the SDKs you need
import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBM3cq-2hoxZvA-3HA9ibDYN4Uiqf3UJrs",
  authDomain: "video-chat-demo-fad9a.firebaseapp.com",
  projectId: "video-chat-demo-fad9a",
  storageBucket: "video-chat-demo-fad9a.appspot.com",
  messagingSenderId: "887754922897",
  appId: "1:887754922897:web:16e53fe4d4d959ac48d830",
  measurementId: "G-0TTS4B8WCM"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();


//HTML Elements
const webcamButton = document.getElementById('webcamButton')
const webcamVideo = document.getElementById('webcamVideo')
const callButton = document.getElementById('callButton')
const callInput = document.getElementById('callInput')
const answerButton = document.getElementById('answerButton')
const remoteVideo = document.getElementById('remoteVideo')
const hangupButton = document.getElementById('hangupButton')


//Global State
const servers = {
    iceServers: [
    {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
    ],
    iceCandidatePoolSize: 10
};

let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;


//Setup media sources
webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    }

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
}

// Create an offer
callButton.onclick = async () => {
    //Reference Firestore collection
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    callInput.value = callDoc.id;

    //Get candidates for caller & save in db
    pc.onicecandidate = event => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
    }

    //Create Offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type
    };

    await callDoc.set({ offer });

    //Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
        const data = sanpshot.data();
        if(!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
        }
    });

    //When answered add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if(change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
            }
        });
    });

    hangupButton.disabled = false;
}

//Answer the call with unique id
answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');

    pc.onicecandidate = event => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();

    const offerDescription = callData.offer;
    await process.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type
    }

    await callDoc.update({ answer });

    offerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            console.log(change);
            if(change.type === 'added') {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
}