#!/usr/bin/python
import time
import json
import os
#import RPi.GPIO as GPIO
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ModuleNotFoundError:
    GPIO_AVAILABLE = False

    class MockGPIO:
        BCM = "BCM"
        OUT = "OUT"
        IN = "IN"
        LOW = 0
        HIGH = 1
        PUD_UP = "PUD_UP"
        FALLING = "FALLING"

        def setmode(self, mode):
            print(f"[MOCK GPIO] setmode({mode})")

        def setwarnings(self, flag):
            print(f"[MOCK GPIO] setwarnings({flag})")

        def setup(self, pin, mode, pull_up_down=None):
            print(f"[MOCK GPIO] setup(pin={pin}, mode={mode})")

        def output(self, pin, value):
            print(f"[MOCK GPIO] output(pin={pin}, value={value})")

        def input(self, pin):
            return self.HIGH

        def add_event_detect(self, pin, edge, callback=None, bouncetime=150):
            print(f"[MOCK GPIO] add_event_detect(pin={pin})")

        def cleanup(self):
            print("[MOCK GPIO] cleanup()")

    GPIO = MockGPIO()
import threading

SETTINGS_FILE = "motor_settings.json"

# ======================
# Motor Configurations
# ======================
MOTORS = {
    1: {"name": "Motor 1", "pins": [17, 18, 27, 22]},
    2: {"name": "Motor 2", "pins": [23, 24, 25, 16]},
    3: {"name": "Motor 3", "pins": [0, 5, 6, 26]},
}

# ======================
# Button pins (BCM numbering)
# ======================
BUTTON_M1 = 12    # Hold to move Motor 1
BUTTON_M2 = 13    # Hold to move Motor 2
BUTTON_M3 = 20    # Hold to move Motor 3
BUTTON_DIR = 21   # Tap to toggle direction

# ======================
# Movement settings
# ======================
STEP_DELAY = 0.004          # seconds per step → smaller = faster (0.001–0.01 typical range)
# 0.004 s/step ≈ 250 steps/sec → reasonable speed for most microscope stages

# Global direction (shared)
current_direction = "clockwise"

# Track if motors are allowed to run (simple flag)
moving = {1: False, 2: False, 3: False}   # we'll set True while button held

def load_settings():
    global current_direction
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            current_direction = data.get("global_direction", "clockwise")
            return data
    return {}

def save_settings():
    data = {"global_direction": current_direction}
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

# Load at start
settings = load_settings()

# ======================
# Single step function (called repeatedly while held)
# ======================
def single_step(motor_index, direction):
    motor = MOTORS[motor_index]
    pins = motor["pins"]
    
    # Simple full-step sequence (you can change to half-step etc.)
    sequence = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ]
    
    # Persistent step counter per motor (so it continues sequence)
    if not hasattr(single_step, "step_counters"):
        single_step.step_counters = {1: 0, 2: 0, 3: 0}
    
    step_dir = 1 if direction == "clockwise" else -1
    seq_idx = single_step.step_counters[motor_index] % 4
    
    # Set coils
    for j in range(4):
        GPIO.output(pins[j], sequence[seq_idx][j])
    
    # Advance sequence
    single_step.step_counters[motor_index] = (single_step.step_counters[motor_index] + step_dir) % 4
    
    # Small delay = speed control
    time.sleep(STEP_DELAY)

# ======================
# Direction toggle callback (still uses event detect)
# ======================
def on_direction_toggle(channel):
    global current_direction
    if GPIO.input(channel) == GPIO.LOW:
        current_direction = "counterclockwise" if current_direction == "clockwise" else "clockwise"
        print(f"Direction changed to: {current_direction.upper()}")
        save_settings()

# ======================
# Setup
# ======================
def setup():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(True)
    
    # Motor pins → output, initially low
    for motor in MOTORS.values():
        for pin in motor["pins"]:
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.LOW)
    
    # Buttons with pull-up (no event detect for motor buttons anymore)
    for btn_pin in [BUTTON_M1, BUTTON_M2, BUTTON_M3]:
        GPIO.setup(btn_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    
    # Direction button still uses event detect
    GPIO.setup(BUTTON_DIR, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.add_event_detect(
        BUTTON_DIR,
        GPIO.FALLING,
        callback=on_direction_toggle,
        bouncetime=150
    )
    
    dir_str = current_direction.upper()
    print(f"Ready. Global direction: {dir_str}")
    print("Hold button 1,2,3 → move corresponding motor continuously")
    print("Release button → stop immediately")
    print("Tap button 4 → toggle direction")

#added helper functions for API calls
is_setup_done = False

def init_motors():
    global is_setup_done

    if not is_setup_done:
        setup()
        is_setup_done = True

    return {
        "status": "Motors initialized",
        "direction": current_direction
    }


def move_motor_steps(motor_index: int, direction: str, steps: int = 50):
    global is_setup_done

    if motor_index not in MOTORS:
        return {"error": "Invalid motor index"}

    if direction not in ["clockwise", "counterclockwise"]:
        return {"error": "Invalid direction"}

    if steps <= 0:
        return {"error": "Steps must be greater than 0"}

    if steps > 500:
        return {"error": "Steps too high. Maximum allowed is 500"}

    if not is_setup_done:
        setup()
        is_setup_done = True

    for _ in range(steps):
        single_step(motor_index, direction)

    # Turn off coils after movement to reduce heating
    for pin in MOTORS[motor_index]["pins"]:
        GPIO.output(pin, GPIO.LOW)

    return {
        "status": "Motor moved",
        "motor": motor_index,
        "direction": direction,
        "steps": steps
    }


def stop_all_motors():
    if not is_setup_done:
        return {"status": "Motors were not initialized"}

    for motor in MOTORS.values():
        for pin in motor["pins"]:
            GPIO.output(pin, GPIO.LOW)

    return {"status": "All motors stopped"}


def cleanup_motors():
    global is_setup_done

    if is_setup_done:
        stop_all_motors()
        GPIO.cleanup()
        save_settings()
        is_setup_done = False

    return {"status": "GPIO cleaned up"}

# ======================
# Main loop – check buttons continuously
# ======================
if __name__ == "__main__":
    try:
        setup()
        
        print("Entering hold-to-move mode...")
        
        while True:
            for motor_idx, btn_pin in [(1, BUTTON_M1), (2, BUTTON_M2), (3, BUTTON_M3)]:
                if GPIO.input(btn_pin) == GPIO.LOW:  # button pressed
                    single_step(motor_idx, current_direction)
                # No else needed → when released, we just stop calling single_step
            
            time.sleep(0.0001)  # tiny sleep to prevent 100% CPU (adjust if needed)
            
    except KeyboardInterrupt:
        print("\nStopped by user.")
    
    finally:
        # Turn off all coils
        for motor in MOTORS.values():
            for pin in motor["pins"]:
                GPIO.output(pin, GPIO.LOW)
        GPIO.cleanup()
        save_settings()
        print("GPIO cleaned up. Direction saved.")