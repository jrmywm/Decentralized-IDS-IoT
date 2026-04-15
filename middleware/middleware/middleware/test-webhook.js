import axios from 'axios';

async function test() {
  const payload = Buffer.from(JSON.stringify({
    deviceId: "ESP32-01",
    attackerIP: "192.168.1.100",
    attackType: "SQL_Injection",
    dangerLevel: 8
  })).toString('base64');

  try {
    const res = await axios.post('http://localhost:3000/webhook', 
      { payload }, 
      { headers: { 'x-helium-token': 'test_secret_123' } }
    );
    console.log("Response:", res.data);
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}

test();
