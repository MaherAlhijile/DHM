# Digital Holography Microscope (DHM) for Automatic Disease Identification Using AI

This repository contains two implementations of a Digital Holography Microscope (DHM) Software:  
 ## Local Version
 standalone desktop software designed to work with the DHM add-on for regular microscopes. It handles live acquisition, phase reconstruction, ROI selection, and image processing locally using the connected Basler camera and the Pylon library.
 
 Code can be found under the **`/local`** directory.

### Local Version Enhancements
  * Organized the program to follow a logical sequence of operations
  * Added functionality to perform all operations with a single click
  * Resolved issues with negative/positive cells in phase computation
  * Enabled batch processing of multiple images
  * Fixed ROI selection – now works correctly from the first click
  * Corrected the thickness functions – each function now opens in a separate, * independent window
    
## Remote Version
This is a web application designed to work with our in-house designed DHM system which is built with FastAPI (backend) and HTML/JS (frontend). It is designed for point-of-care and cloud-based diagnostics.. It supports remote image upload, cloud-based reconstruction, AI-powered diagnostics, and batch analysis. It is built for scalability and accessibility, enabling point-of-care usage without the need for local processing power. 

Features include:

* Remote image upload and analysis

* 3D and 1D thickness profiling

* Live camera integration (via Basler Pylon)

* Configurable microscope parameters via frontend GUI
---

### Remote Version Enhancements
  * Improved the noise reduction functionality using Artificial Intelligence
  * Trained a machine learning model for remote, label-free, automated point-of-care disease diagnosis
  * Used features extracted from DHM to train ML algorithms for detecting diseases such as malaria and sickle cell anemia
  * REST API endpoints for:
       ** /run_phase_difference – Compute phase maps
       
       ** /compute_3d – Generate 3D surface thickness data
       
       ** /compute_1d – Extract 1D thickness profile
       
       ** /check_spectrum – Fourier spectrum validation
       
       ** /start_camera, /stop_camera, /camera_feed – Camera control & streaming

### Folder Structure:
```
/remote
   ├── backend/
   │     ├── server.py         # FastAPI server + endpoints
   │     ├── sys_functions.py  # Phase reconstruction + analysis
   ├── frontend/
   │     ├── index.html        # Web GUI
   │     ├── css/
   │     ├── js/
   ├── libs/                   # Shared libraries and utilities
   │     ├── WiringPi/         
   │     ├── stepper_motor/
```

## Prerequisites
For both versions, make sure you have the following installed on your system:

- Python 3.0+

- an IDE

- pip (Python package manager)

- Git (to clone the repository)

For the remote version make sure an operating system installed on the Raspberry Pi

---

## Installation
Start by cloning the repo into your local machine
it has 3 directories: Remote & Local & Libs

Before starting make sure to setup a virtual environment in the top-level of directory. You can create and activate the environment by typing the commands:
```bash
python -m venv .venv
source .venv/bin/activate
```

Now you can start installing the required dependencies for both local & remote versions using the command:
```bash
pip install -r requirements.txt 
```

For the remote versions the motors movement library should be installed, access the library directory and install it by typing the commands
```bash
cd libs/stepper_motor
pip install .
```

---

### How to Run the Remote version:
1. Find the microscope's IP address (Linux)  
Run one of the following commands in the terminal:  
```bash
hostname -I
   
2. Navigate to the backend folder
```Bash
cd remote/backend
uvicorn --DHM <replace with microscope's IP> server:app --port:<replace with port of your choice> --reload
```

This starts the FastAPI server at http://<replace with microscope's IP>

3. Open the frontend (remote/frontend/index.html) in a browser.

4. Configure microscope/connection parameters

5. Upload object & reference images or connect to the Basler camera

6. Run computations (Phase Difference, ROI, 3D profile, 1D profile)

