/* Main script of the preferences window */

const ipc = require('electron').ipcRenderer

const submitBtn = document.getElementById('submit-btn')
const urlField = document.getElementById('url-field')
const errorField = document.getElementById("error-field")

submitBtn.addEventListener('click', function () {
  errorField.classList ="";
  console.info("Testing URL: " , urlField.value)
  ipc.send('test-url', urlField.value)
});

ipc.on('url-test-reply', function (event, arg) {
	console.info("Got result", arg);

	if (arg.success) {
		ipc.send('save-and-open-dss', arg)
	} else {
		errorField.innerHTML = "Oops... this does not look like a valid DSS URL: " + arg.error;
		errorField.classList += "visible";
	}
})
