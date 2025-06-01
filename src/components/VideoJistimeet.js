import React, { useState, useRef, useEffect } from "react";

const VideoCallApp = () => {
  const [callStarted, setCallStarted] = useState(false);
  const jitsiContainerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    if (callStarted) {
      if (!window.JitsiMeetExternalAPI) {
        alert("Jitsi Meet API লোড হয়নি!");
        return;
      }

      // Jitsi API সেটআপ
      apiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName: "doctor_patient_room_123", // ডাইনামিক রুম নাম দিতে পারো
        parentNode: jitsiContainerRef.current,
        width: "100%",
        height: 600,
        userInfo: {
          displayName: "User Name", // ডাইনামিক ইউজার নাম দিতে পারো
        },
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: false,
        },
        interfaceConfigOverwrite: {
          // এখানে ইন্টারফেস কাস্টমাইজ করতে পারো
          TOOLBAR_BUTTONS: [
            "microphone",
            "camera",
            "hangup",
            "chat",
            "fullscreen",
            "settings",
            "raisehand",
            "videoquality",
            "tileview",
          ],
        },
      });
    }

    // Cleanup: Call End হলে Jitsi dispose হবে
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [callStarted]);

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      {!callStarted && (
        <button
          onClick={() => setCallStarted(true)}
          style={{
            fontSize: "20px",
            padding: "15px 30px",
            cursor: "pointer",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 8,
          }}
          title="Start Video Call"
        >
          📞 Start Video Call
        </button>
      )}

      {callStarted && (
        <div>
          <div
            ref={jitsiContainerRef}
            style={{ height: 600, width: "100%", borderRadius: 8, overflow: "hidden" }}
          ></div>
          <button
            onClick={() => setCallStarted(false)}
            style={{
              marginTop: 10,
              padding: "10px 20px",
              cursor: "pointer",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 8,
            }}
          >
            ❌ End Call
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoCallApp;




