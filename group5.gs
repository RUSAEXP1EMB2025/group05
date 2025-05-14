const REMO_TOKEN = "Bearer ory_at_Jc09TaraY0Gn53HBl0IZSiulRnHJdaAKBHU38ysrU2U.FwJW7jmtsBlKrx0L3eCl-vfZayGuOTCMIRAS6W7dgqc"; // Nature Remo のトークン
const LINE_REPLY_TOKEN = "q18J+eaAiD5rswOoYsOPJekG8go4VPLJjER/f9poU8UkaE9MGlNL9q/4KAhsmojueJ4O8w7SfmRq2laeUIJdXBu56ygWsj/anq1J2qf2KnCUi1UyYkIYtAYSgusnWlsbvg1iYsAMXsCwmkb+gUl62gdB04t89/1O/w1cDnyilFU="; // LINE Bot のトークン

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("OK");
    }

    const json = JSON.parse(e.postData.contents);
    const replyToken = json.events[0].replyToken;
    const message = json.events[0].message.text.toLowerCase();

    // 家電・センサー取得
    const appliances = JSON.parse(UrlFetchApp.fetch("https://api.nature.global/1/appliances", {
      headers: { Authorization: REMO_TOKEN }
    }).getContentText());
    const devices = JSON.parse(UrlFetchApp.fetch("https://api.nature.global/1/devices", {
      headers: { Authorization: REMO_TOKEN }
    }).getContentText());

    const aircon = appliances.find(appliance => appliance.type === "AC");
    if (!aircon) return reply(replyToken, "エアコンが見つかりません");

    const url = `https://api.nature.global/1/appliances/${aircon.id}/aircon_settings`;
    let payload = null;
    let responseMessage = "";

    // センサーから温度・湿度取得（あれば）
    const temp = devices[0]?.newest_events?.te?.val || 25;
    const humid = devices[0]?.newest_events?.hu?.val || 50;
    const di = 0.81 * temp + 0.01 * humid * (0.99 * temp - 14.3) + 46.3;

    switch (message) {
      case "on":
      case "冷房":
        payload = { operation_mode: "cool", temperature: "25", air_volume: "auto" };
        responseMessage = "冷房をONにしました（25℃）";
        break;

      case "off":
        payload = { button: "power-off" };
        responseMessage = "エアコンをOFFにしました";
        break;

      case "暖房":
        payload = { operation_mode: "warm", temperature: "22", air_volume: "auto" };
        responseMessage = "暖房をONにしました（22℃）";
        break;

      case "除湿":
        payload = { operation_mode: "dry", temperature: "25", air_volume: "auto" };
        responseMessage = "除湿モードをONにしました";
        break;

      case "自動":
        let desiredMode, desiredTemp;

        if (di >= 65) {
          desiredMode = "cool";
          desiredTemp = Math.max(18, Math.round(temp - 2));
        } else if (di <= 58) {
          desiredMode = "warm";
          desiredTemp = Math.min(28, Math.round(temp + 2));
        } else {
          responseMessage = `快適な状態です（DI=${Math.round(di)}）。操作は不要です。`;
          return reply(replyToken, responseMessage);
        }

        payload = {
          operation_mode: desiredMode,
          temperature: desiredTemp.toString(),
          air_volume: "auto"
        };
        responseMessage = `自動調整：${desiredMode === "cool" ? "冷房" : "暖房"}を${desiredTemp}℃で設定しました（DI=${Math.round(di)}）`;
        break;

      default:
        responseMessage = "「冷房」「暖房」「除湿」「ON」「OFF」「自動」から選んでください";
    }

    if (payload) {
      UrlFetchApp.fetch(url, {
        method: "post",
        headers: { Authorization: REMO_TOKEN },
        payload: payload
      });
    }

    return reply(replyToken, responseMessage);
  } catch (error) {
    Logger.log(error);
    return ContentService.createTextOutput("Error");
  }
}

// LINEへの返信処理
function reply(token, message) {
  const payload = JSON.stringify({
    replyToken: token,
    messages: [{ type: "text", text: message }]
  });

  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_REPLY_TOKEN
    },
    payload: payload
  });

  return ContentService.createTextOutput("OK");
}
