if ('serial' in navigator) {
    notSupported = document.getElementById('notSupported');
    notSupported.classList.add('hidden');
}

log = document.getElementById("log");
var running = false;
date = new Date().toJSON().replaceAll(":", "-");
var chart_p;
var chart_t
var chart_a;
var i=0;

function send() {
    const toSend = document.getElementById("input").value
    writeToStream(toSend)
    document.getElementById("input").value = ""

}

function handle(e) {
    if (e.keyCode === 13) {
        e.preventDefault();
        send();
    }
}

async function connect() {
    button = document.getElementById("connect")
    if (button.innerHTML === "Стоп") {
        // FIXME: сделать стоп, чтобы можно было снова стартовать
        running = false;
        reader.releaseLock();
        button.innerHTML = "Подключиться";
        port.close()
        return;
    }
    button.disabled = true;

    // Запуск монитора порта
    port = await navigator.serial.requestPort();
    baud = parseInt(document.getElementById("baudrate").value);
    try {
        await port.open({
            baudRate: baud
        });
    } catch (err) {
        button.disabled = false;
        errDiv = document.createElement("div");
        errDiv.innerHTML = err;
        document.getElementById("error").appendChild(errDiv);
        return;
    }

    button.disabled = false;
    running = true;

    initCharts();

    const inputField = document.getElementById("input");
    inputField.disabled = false;
    inputField.focus();
    inputField.select();
    document.getElementById("sendButton").disabled = false;
    button.innerHTML = "Остановить";

    let decoder = new TextDecoderStream();
    inputDone = port.readable.pipeTo(decoder.writable);
    inputStream = decoder.readable;

    const encoder = new TextEncoderStream();
    outputDone = encoder.readable.pipeTo(port.writable);
    outputStream = encoder.writable;

    reader = inputStream.getReader();
    readLoop();
}

function initCharts() {
    ctx = document.getElementById("p_chart")
    chart_p = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Pressure',
                data: [],
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
						  }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    ctx = document.getElementById("t_chart")
    chart_t = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temp',
                data: [],
                fill: false,
                borderColor: 'rgb(255, 50, 50)',
                tension: 0.1
						  }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    ctx = document.getElementById("a_chart")
    chart_a = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                    label: 'X',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(255, 0, 0)',
                    tension: 0.1
						  },
                {
                    label: 'Y',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(0, 255, 0)',
                    tension: 0.1
						  },
                {
                    label: 'Z',
                    data: [],
                    fill: false,
                    borderColor: 'rgb(0, 0, 255)',
                    tension: 0.1
						  }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

function writeToStream(line) {
    const writer = outputStream.getWriter();
    console.log('[SEND]', line);
    writer.write(line + '\r');
    writer.releaseLock();
}

async function readLoop() {
    console.log('Readloop');
    buf = "";

    while (running) {
        const {
            value,
            done
        } = await reader.read();

        if (value) {
            [...value].forEach((ch) => {
                buf += ch
                if (ch === "\n") {
                    appendTelemetry(buf);
                    /* Парсинг */
                    data = buf.split(';')
                    line = document.createElement("div");
                    line.innerHTML = buf;
                    line.classList.add("line");
                    buf = "";
                    if (data.length != 6) {
                        line.style['color'] = 'red';
                        log.appendChild(line);
                        return
                    }
                    log.appendChild(line);
                    now = data[0] / 1000;
                    document.querySelector("#time").innerHTML = "Время:       " + now + " с";
                    pressure = data[1].slice(1, );
                    document.querySelector("#pres").innerHTML = "Давление:    " + pressure + " Па";
                    temperature = data[2].slice(1, ) / 100;
                    document.querySelector("#temp").innerHTML = "Температура: " + temperature + " С";

                    accel_x = parseInt(data[3].slice(1, ));
                    accel_y = parseInt(data[4].slice(1, ));
                    accel_z = parseInt(data[5].slice(1, ));

                    drawAxes();

                    if (i % 3 == 0) {
                        chart_p.data.labels.push(now);
                        chart_p.data.datasets[0].data.push(pressure);
                        chart_p.update();

                        chart_t.data.labels.push(now);
                        chart_t.data.datasets[0].data.push(temperature);
                        chart_t.update();

                        chart_a.data.labels.push(now);
                        chart_a.data.datasets[0].data.push(accel_x);
                        chart_a.data.datasets[1].data.push(accel_y);
                        chart_a.data.datasets[2].data.push(accel_z);
                        chart_a.update();
                    }

                    i++;
                    log.scrollTop = log.scrollHeight;
                }
            });
        }
        if (done) {
            console.log('[readLoop] DONE', done);
            reader.releaseLock();
            break;
        }
    }
}

function appendTelemetry(buf) {
    storage = localStorage.getItem("telemetry_" + date);
    storage += buf;
    localStorage.setItem("telemetry_" + date, storage);
}

function download() {
    text = localStorage.getItem("telemetry_" + date);
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', "telemetry_" + date + ".txt");

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function drawAxes() {
    ctx = document.getElementById("axes").getContext("2d");
    ctx.clearRect(0, 0, 250, 250);
    ctx.beginPath();
    ctx.moveTo(125, 125);
    ctx.strokeStyle = 'blue';
    ctx.lineTo(125, 125 - 125 * accel_z / 9000);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(125, 125);
    ctx.strokeStyle = 'red';
    dx = 125 * accel_x / 9000 * 0.7;
    ctx.lineTo(125 + dx, 125 + dx);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(125, 125);
    ctx.strokeStyle = 'lime';
    dy = 125 * accel_y / 9000 * 0.7;
    ctx.lineTo(125 - dy, 125 + dy);
    ctx.stroke();
}
