import React, { useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";

const SOCKET_SERVER_URL = "https://video-call-react-backand.onrender.com";

const iceServers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const VideoCall = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const socket = useRef(null);
  const localStream = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const remoteDescriptionSet = useRef(false);
  const pendingCandidates = useRef([]);

  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL);

    socket.current.on("offer", handleReceiveOffer);
    socket.current.on("answer", handleReceiveAnswer);
    socket.current.on("ice-candidate", handleNewICECandidateMsg);

    return () => {
      socket.current.disconnect();
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setScreenSharing(false);
    }
    setInCall(false);
    remoteDescriptionSet.current = false;
    pendingCandidates.current = [];
  };

  const startCall = async () => {
    try {
      setInCall(true);

      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = localStream.current;

      createPeerConnection();

      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.current.emit("offer", offer);
    } catch (err) {
      console.error("Error starting call:", err);
    }
  };

  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection(iceServers);

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("ice-candidate", event.candidate);
      }
    };
  };

  const handleReceiveOffer = async (offer) => {
    try {
      setInCall(true);
      createPeerConnection();

      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = localStream.current;

      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });

      await peerConnection.current.setRemoteDescription(offer);
      remoteDescriptionSet.current = true;

      // Apply any queued ICE candidates now
      pendingCandidates.current.forEach((candidate) => {
        peerConnection.current.addIceCandidate(candidate).catch((err) => {
          console.error("Error adding queued candidate", err);
        });
      });
      pendingCandidates.current = [];

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.current.emit("answer", answer);
    } catch (err) {
      console.error("Error handling offer:", err);
    }
  };

  const handleReceiveAnswer = async (answer) => {
    try {
      await peerConnection.current.setRemoteDescription(answer);
      remoteDescriptionSet.current = true;

      // Apply any queued ICE candidates now
      pendingCandidates.current.forEach((candidate) => {
        peerConnection.current.addIceCandidate(candidate).catch((err) => {
          console.error("Error adding queued candidate", err);
        });
      });
      pendingCandidates.current = [];
    } catch (err) {
      console.error("Error handling answer:", err);
    }
  };

  const handleNewICECandidateMsg = async (candidate) => {
    try {
      const iceCandidate = new RTCIceCandidate(candidate);
      if (remoteDescriptionSet.current) {
        await peerConnection.current.addIceCandidate(iceCandidate);
      } else {
        pendingCandidates.current.push(iceCandidate);
      }
    } catch (err) {
      console.error("Error adding received ICE candidate", err);
    }
  };

  const endCall = () => {
    cleanup();
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const toggleAudio = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
    });
  };

  const toggleVideo = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
    });
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setScreenStream(screenStream);
        setScreenSharing(true);

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.current
          .getSenders()
          .find((s) => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Error starting screen share:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (!screenSharing) return;

    screenStream.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setScreenSharing(false);

    if (!localStream.current) return;

    const videoTrack = localStream.current.getVideoTracks()[0];
    const sender = peerConnection.current
      .getSenders()
      .find((s) => s.track.kind === "video");
    if (sender) {
      sender.replaceTrack(videoTrack);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: 20 }}>
      <h2>One-to-One Video Call</h2>
      {!inCall && (
        <button onClick={startCall} style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}>
          🎥 ভিডিও কল শুরু করো
        </button>
      )}

      {inCall && (
        <>
          <div style={{ marginBottom: 10 }}>
            <button onClick={endCall} style={{ marginRight: 10 }}>
              ❌ কল শেষ করো
            </button>
            <button onClick={toggleAudio} style={{ marginRight: 10 }}>
              {audioEnabled ? "🔊 Mute" : "🔈 Unmute"}
            </button>
            <button onClick={toggleVideo} style={{ marginRight: 10 }}>
              {videoEnabled ? "🎥 Video Off" : "📷 Video On"}
            </button>
            <button onClick={toggleScreenShare}>
              {screenSharing ? "🛑 Screen Share Stop" : "📺 Screen Share Start"}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            <div>
              <p>Local Video</p>
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 300, border: "1px solid black" }} />
            </div>

            <div>
              <p>Remote Video</p>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 300, border: "1px solid black" }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoCall;
