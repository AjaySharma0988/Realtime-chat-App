import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { CheckCircle, XCircle, Loader2, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

const LinkDeviceApprovalPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const navigate  = useNavigate();

  const [status, setStatus]   = useState("idle"); // idle|loading|success|error
  const [errorMsg, setErrorMsg] = useState("");

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <XCircle className="size-16 text-error mx-auto" />
          <h2 className="text-xl font-bold">Invalid QR Code</h2>
          <p className="text-base-content/60">No session ID found. Please scan a valid QR code.</p>
          <button onClick={() => navigate("/")} className="btn btn-outline rounded-full">Go Home</button>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setStatus("loading");
    try {
      await axiosInstance.post("/auth/link-device", { sessionId });
      setStatus("success");
      toast.success("Device linked!");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.response?.data?.message || "Failed to link device");
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div
        className="bg-base-200 border border-base-300 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6"
        style={{ animation: "wa-pop-in 0.2s ease-out" }}
      >
        {status === "idle" && (
          <>
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Smartphone className="size-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Link a Device</h2>
              <p className="text-sm text-base-content/60">
                A computer is trying to log in to your Chatty account.<br />
                Do you want to approve this?
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate("/")} className="btn flex-1 btn-ghost rounded-full">
                Cancel
              </button>
              <button onClick={handleApprove} className="btn flex-1 btn-primary rounded-full">
                Approve
              </button>
            </div>
          </>
        )}

        {status === "loading" && (
          <div className="py-8 space-y-4">
            <Loader2 className="size-12 text-primary animate-spin mx-auto" />
            <p className="text-base-content/70 font-medium">Linking device…</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8 space-y-4">
            <CheckCircle className="size-16 text-success mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-success">Device Linked!</h2>
              <p className="text-sm text-base-content/60 mt-1">
                You can now use Chatty on that device.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="py-8 space-y-4">
            <XCircle className="size-16 text-error mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-error">Link Failed</h2>
              <p className="text-sm text-base-content/60 mt-1">{errorMsg}</p>
            </div>
            <button onClick={() => navigate("/")} className="btn btn-outline rounded-full w-full">
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkDeviceApprovalPage;
