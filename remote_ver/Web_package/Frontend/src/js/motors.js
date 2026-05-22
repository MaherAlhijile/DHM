// motors.js – stage / focus motor control

let motorPending = false;

const MOTOR_BTNS = ["btn-up","btn-down","btn-left","btn-right","btn-z-up","btn-z-down","btn-stop"];

function setMotorBtnsDisabled(disabled) {
  MOTOR_BTNS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${API}/motors/init`).catch(() => {});

  document.getElementById("btn-up")    .addEventListener("click", () => moveMotor(2, "clockwise"));
  document.getElementById("btn-down")  .addEventListener("click", () => moveMotor(2, "counterclockwise"));
  document.getElementById("btn-left")  .addEventListener("click", () => moveMotor(1, "counterclockwise"));
  document.getElementById("btn-right") .addEventListener("click", () => moveMotor(1, "clockwise"));
  document.getElementById("btn-z-up")  .addEventListener("click", () => moveMotor(3, "clockwise"));
  document.getElementById("btn-z-down").addEventListener("click", () => moveMotor(3, "counterclockwise"));
  document.getElementById("btn-stop")  .addEventListener("click", stopAllMotors);
});

async function moveMotor(motor, direction) {
  if (motorPending) return;
  motorPending = true;
  setMotorBtnsDisabled(true);

  const steps  = parseInt(document.getElementById("stepsInput").value) || 50;
  const status = document.getElementById("dpad-status");
  status.textContent = `Moving motor ${motor}…`;

  try {
    const res  = await fetch(`${API}/motors/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motor, direction, steps })
    });
    const data = await res.json();
    status.textContent = data.error
      ? `Error: ${data.error}`
      : `M${motor} · ${direction === "clockwise" ? "CW" : "CCW"} · ${steps} steps`;
  } catch {
    status.textContent = "Request failed — server unreachable?";
  } finally {
    motorPending = false;
    setMotorBtnsDisabled(false);
  }
}

async function stopAllMotors() {
  if (motorPending) return;
  motorPending = true;
  setMotorBtnsDisabled(true);

  const status = document.getElementById("dpad-status");
  status.textContent = "Stopping…";
  try {
    await fetch(`${API}/motors/stop`, { method: "POST" });
    status.textContent = "Stopped.";
  } catch {
    status.textContent = "Stop failed.";
  } finally {
    motorPending = false;
    setMotorBtnsDisabled(false);
  }
}

window.addEventListener("beforeunload", () => {
  navigator.sendBeacon(`${API}/motors/cleanup`);
});