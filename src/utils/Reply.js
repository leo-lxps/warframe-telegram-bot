const Telegraf = require("telegraf"),
  data = require("../db/data.json"),
  request = require("request"),
  moment = require("moment"),
  fs = require("fs"),
  Util = require("./Util");

var times = [];
const noItemsMsg =
  "No items in filter\nAdd with `/alert <filter>`\nOr `/alert all` for all alerts";

const Reply = {
  lastQuery: "",
  queryCount: 0,
  current0ffset: 0,
  options: ctx => {
    var answerOut = "You are currently *not* receiving automatic updates! :(";
    var answerIn = "You are currently receiving automatic updates! :)";
    var answer = ctx.session.user.optIn ? answerIn : answerOut;
    ctx
      .editMessageText(
        answer,
        Telegraf.Extra.markdown().markup(m =>
          m.inlineKeyboard([
            [
              m.callbackButton("BACK", "backCallback"),
              !ctx.session.user.optIn
                ? m.callbackButton("SUBSCRIBE", "optinCallback")
                : m.callbackButton("UNSUBSCRIBE", "optoutCallback")
            ]
          ])
        )
      )
      .catch(err => {
        if (err.code != 400) console.log(err);
      });
  },
  info: ctx => {
    var answer = `
    \`>\` *SORTIE INFO* \`<\`
    _Click on the buttons to find out more!_`;
    Util.getSortie(sortie => {
      if (!sortie) return;
      ctx
        .editMessageText(
          answer,
          Telegraf.Extra.markdown().markup(m =>
            m.inlineKeyboard(
              sortie.variants
                .map((v, i) => [
                  m.callbackButton(v.modifier, "modifier" + i + "Callback")
                ])
                .concat([
                  [
                    m.callbackButton("BACK", "backCallback"),
                    m.callbackButton(
                      sortie.boss,
                      sortie.boss + ".bossCallback"
                    ),
                    m.callbackButton(sortie.eta, "etaCallback")
                  ]
                ])
            )
          )
        )
        .catch(err => {
          if (err.code != 400) console.log(err);
        });
    });
  },
  alert: (ctx, bot) => {
    ctx.session.alertItems = ctx.session.alertItems || [];
    const argsStr = ctx.state.command.splitArgs.join(" ");
    const args = argsStr.split(",");
    args.forEach(arg => {
      const match = arg.match(/([\w ]+)/g) || [""];
      const item = match[0].trim();
      if (item != "") {
        if (item.toUpperCase() == "ALL") {
          var exists = false;
          ctx.session.alertItems.forEach(aItem => {
            if (aItem.toUpperCase() == "ALL") exists = true;
          });
          if (!exists) ctx.session.alertItems.push(item);
        } else {
          if (ctx.session.alertItems.length > 0) {
            var added = false;
            ctx.session.alertItems.forEach((aItem, ind) => {
              var isAll = aItem.toUpperCase() == "ALL";
              if (isAll) {
              } else if (aItem.toUpperCase().includes(item.toUpperCase())) {
                added = true;
                ctx.session.alertItems.splice(ind, 1, item);
              } else if (item.toUpperCase().includes(aItem.toUpperCase())) {
                added = true;
              }
            });
            if (!added) ctx.session.alertItems.push(item);
          } else {
            if (item.length > 0) ctx.session.alertItems.push(item);
          }
        }
      }
    });
    ctx.session.alertItems = ctx.session.alertItems.filter(function(
      item,
      pos,
      self
    ) {
      return self.indexOf(item) == pos;
    });
    if (ctx.session.alertItems.length > 0) {
      const remApp = Telegraf.Extra.markdown().markup(m =>
        m.inlineKeyboard([
          [
            m.callbackButton("BACK", "showFilterCallback"),
            m.callbackButton("REMOVE", "removeItemCallback")
          ],
          [
            m.callbackButton("DASHBOARD", "dashCallback"),
            m.switchToCurrentChatButton(
              "SEARCH",
              ctx.session.alertItems.join(", ")
            )
          ]
        ])
      );
      const msg =
        "Updated list:\n" +
        ctx.session.alertItems.reduce(
          (str, i) => (str += "`" + i + "`\n"),
          ""
        ) +
        "\n_Add items with /alert <item>_";
      ctx.replyWithMarkdown(msg, remApp);
      Reply.checkAlert(ctx.session.alertItems, ctx.from.id, bot);
    } else {
      ctx.replyWithMarkdown(noItemsMsg);
    }
  },
  ignored: ctx => {
    ctx.replyWithMarkdown("Ignored Alerts:\n" + Util.getNotified().join("\n"));
  },
  checkAlert: (
    alertItems,
    userId,
    shortApi,
    ignoreNotified,
    printAll,
    editMessage,
    returnString,
    Callback,
    types
  ) => {
    if (!alertItems || !userId || !shortApi) {
      console.log(
        "CheckAlert: Missing (alertItems, userId, shortApi):",
        alertItems,
        userId,
        shortApi
      );
      return;
    }
    const bot = shortApi.telegram;

    const selected = "<";

    const alertBtn = types
      ? types.includes("Alert")
        ? "ALERTS " + selected
        : "ALERTS"
      : "ALERTS";
    const invasionsBtn = types
      ? types.includes("Invasion")
        ? "INVASIONS " + selected
        : "INVASIONS"
      : "INVASIONS";
    const bountyBtn = types
      ? types.includes("Bounty")
        ? "BOUNTIES " + selected
        : "BOUNTIES"
      : "BOUNTIES";

    const allBtn = types ? types[0] + ".showAllCallback" : "showAllCallback";
    const filterBtn = types
      ? types[0] + ".showFilterCallback"
      : "showFilterCallback";
    const refreshBtn = types
      ? types[0] + ".refreshAlertsCallback"
      : "refreshAlertsCallback";
    const refreshAllBtn = types
      ? types[0] + ".refreshAllAlertsCallback"
      : "refreshAllAlertsCallback";
    const noAlerts =
      "No " + (types ? types.join("/") : "Alerts/Invasions/Bounties");
    const more = Telegraf.Extra.markdown().markup(m =>
      m.inlineKeyboard([
        [
          m.callbackButton("MORE", allBtn),
          m.callbackButton("FILTER", "filterCallback"),
          m.callbackButton("REFRESH", refreshBtn)
        ],
        [m.callbackButton("DASHBOARD", "dashCallback")]
      ])
    );
    if (alertItems.length < 1 && !printAll) {
      if (!ignoreNotified && !editMessage && !returnString) return;
      if (editMessage) {
        shortApi.editMessageText(noAlerts, more).catch(err => {
          if (err.code != 400) console.log(err);
        });
      } else if (returnString) {
        Callback(noAlerts);
      } else {
        bot.sendMessage(userId, noAlerts, more);
      }
    } else {
      const msg = alerts =>
        alerts.reduce((str, al) => (str += al.message), "") + "\n";

      const search = alerts =>
        alerts
          .reduce(
            (str, al) =>
              (str += al.item ? al.item.replace("Blueprint", "") + ", " : ""),
            ""
          )
          .slice(0, -2);

      /** GET ALERTS */
      Util.getInfo(
        alerts => {
          const less = Telegraf.Extra.markdown().markup(m =>
            m.inlineKeyboard([
              [
                m.callbackButton("LESS", filterBtn),
                m.callbackButton("FILTER", "filterCallback"),
                m.callbackButton("REFRESH", refreshAllBtn)
              ],
              [
                m.callbackButton(alertBtn, "Alert.showAllCallback"),
                m.callbackButton(invasionsBtn, "Invasion.showAllCallback"),
                m.callbackButton(bountyBtn, "Bounty.showAllCallback")
              ],
              [
                m.callbackButton("DASHBOARD", "dashCallback"),
                m.switchToCurrentChatButton("SEARCH", search(alerts))
              ]
            ])
          );
          const more = Telegraf.Extra.markdown().markup(m =>
            m.inlineKeyboard([
              [
                m.callbackButton("ALL", allBtn),
                m.callbackButton("FILTER", "filterCallback"),
                m.callbackButton("REFRESH", refreshBtn)
              ],
              [
                m.callbackButton(alertBtn, "Alert.showFilterCallback"),
                m.callbackButton(invasionsBtn, "Invasion.showFilterCallback"),
                m.callbackButton(bountyBtn, "Bounty.showFilterCallback")
              ],
              [
                m.callbackButton("DASHBOARD", "dashCallback"),
                m.switchToCurrentChatButton("SEARCH", search(alerts))
              ]
            ])
          );

          if (printAll) {
            if (alerts.length > 0) {
              if (editMessage) {
                shortApi.editMessageText(msg(alerts), less).catch(err => {
                  if (err.code != 400) console.log(err);
                });
              } else if (returnString) {
                Callback(msg(alerts));
              } else {
                bot.sendMessage(userId, msg(alerts), less);
              }
              sendAll = true;
            } else {
              if (editMessage) {
                shortApi.editMessageText(noAlerts, less).catch(err => {
                  if (err.code != 400) console.log(err);
                });
              } else if (returnString) {
                Callback(noAlerts);
              } else {
                bot.sendMessage(userId, noAlerts, less);
              }
              sendAll = true;
            }
          } else {
            var userAlerts = [];
            var sendAll = false;
            alertItems.forEach(a => {
              if (a.toUpperCase() == "ALL") {
                if (alerts.length > 0) {
                  if (editMessage) {
                    shortApi.editMessageText(msg(alerts), more).catch(err => {
                      if (err.code != 400) console.log(err);
                    });
                  } else if (returnString) {
                    Callback(msg(alerts));
                  } else {
                    bot.sendMessage(userId, msg(alerts), more);
                  }
                  sendAll = true;
                }
              } else {
                alerts.forEach(al => {
                  if (
                    al.message.toUpperCase().includes(a.toUpperCase()) &&
                    !userAlerts.includes(al)
                  ) {
                    userAlerts.push(al);
                  }
                });
              }
            });
            const moreUser = Telegraf.Extra.markdown().markup(m =>
              m.inlineKeyboard([
                [
                  m.callbackButton("ALL", allBtn),
                  m.callbackButton("FILTER", "filterCallback"),
                  m.callbackButton("REFRESH", refreshBtn)
                ],
                [
                  m.callbackButton(alertBtn, "Alert.showFilterCallback"),
                  m.callbackButton(invasionsBtn, "Invasion.showFilterCallback"),
                  m.callbackButton(bountyBtn, "Bounty.showFilterCallback")
                ],
                [
                  m.callbackButton("DASHBOARD", "dashCallback"),
                  m.switchToCurrentChatButton("SEARCH", search(userAlerts))
                ]
              ])
            );
            if (!sendAll && userAlerts.length > 0) {
              if (editMessage) {
                shortApi
                  .editMessageText(msg(userAlerts), moreUser)
                  .catch(err => {
                    if (err.code != 400) console.log(err);
                  });
              } else if (returnString) {
                Callback(msg(userAlerts));
              } else {
                bot.sendMessage(userId, msg(userAlerts), moreUser);
              }
            } else if (!sendAll && ignoreNotified) {
              //no alert found with filter
              if (editMessage) {
                shortApi.editMessageText(noAlerts, moreUser).catch(err => {
                  if (err.code != 400) console.log(err);
                });
              } else if (returnString) {
                Callback("");
              } else {
                bot.sendMessage(userId, noAlerts, moreUser);
              }
            }
          }
        },
        ignoreNotified,
        types
      );
    }
  },
  listAlert: (ctx, editMessage) => {
    ctx.session.alertItems = ctx.session.alertItems || [];
    const remApp = Telegraf.Extra.markdown().markup(m =>
      m.inlineKeyboard([
        [
          m.callbackButton("BACK", "showFilterCallback"),
          m.callbackButton("REMOVE", "removeItemCallback")
        ],
        [
          m.callbackButton("DASHBOARD", "dashCallback"),
          m.switchToCurrentChatButton(
            "SEARCH",
            ctx.session.alertItems.join(", ")
          )
        ]
      ])
    );
    const ok = Telegraf.Extra.markdown().markup(m =>
      m.inlineKeyboard([
        // [m.callbackButton("OK", "applyCallback")],
        [m.callbackButton("DASHBOARD", "dashCallback")]
      ])
    );
    if (ctx.session.alertItems.length > 0) {
      var msg =
        ctx.session.alertItems.reduce(
          (str, a) => (str += "`" + a + "`\n"),
          "Items in filter:\n"
        ) + "\n_Add items with /alert <item>_";
      if (editMessage) {
        ctx.editMessageText(msg, remApp).catch(err => {
          console.log(err);
        });
      } else {
        ctx.replyWithMarkdown(msg, remApp);
      }
    } else {
      if (editMessage) {
        ctx.editMessageText(noItemsMsg, ok).catch(err => {
          console.log(err);
        });
      } else {
        ctx.replyWithMarkdown(noItemsMsg, ok);
      }
    }
  },
  removeAlertItem: ctx => {
    ctx.session.alertItems = ctx.session.alertItems || [];
    ctx
      .editMessageText(
        "Click item to *remove*:",
        Telegraf.Extra.markdown().markup(m =>
          m.inlineKeyboard(
            ctx.session.alertItems
              .map(item => {
                return [m.callbackButton(item, item + ".removeFilterItem")];
              })
              .concat([
                [m.callbackButton("CANCEL", "cancelItemRemoveCallback")]
              ])
          )
        )
      )
      .catch(err => {
        if (err.code != 400) console.log(err);
      });
  },
  cancel: ctx => {
    ctx.editMessageText("Canceled!").catch(err => {
      if (err.code != 400) console.log(err);
    });
  },
  apply: ctx => {
    ctx.editMessageText("Applied!").catch(err => {
      if (err.code != 400) console.log(err);
    });
  },
  callback: ctx => {
    const btn = ctx.callbackQuery.data;
    const userId = ctx.callbackQuery.from.id;
    if (btn.includes("modifier")) {
      Util.getSortie(sortie => {
        const ind = parseInt(btn.charAt(8));
        ctx.answerCbQuery(sortie.variants[ind].modifierDescription, true);
      });
    } else if (btn.includes("missionType")) {
      const ind = parseInt(btn.charAt(11));
    } else if (btn.includes("removeFilterItem")) {
      ctx.session.alertItems = ctx.session.alertItems || [];
      const item = btn.split(".")[0];
      ctx.answerCbQuery("Removed: " + item);
      ctx.session.alertItems.splice(ctx.session.alertItems.indexOf(item), 1);
      Reply.listAlert(ctx, true);
    } else if (btn == "timeCallback") {
      Util.getSortie(sortie => {
        var answer = "";
        sortie.variants.forEach((v, i) => {
          answer += i + 1 + ". " + v.missionType + " - " + times[i] + "m\n";
        });
        ctx.answerCbQuery(answer, true);
      });
    } else if (btn == "etaCallback") {
      Util.getSortie(sortie => {
        var answer = "Reset: " + moment(sortie.expiry).format("ddd - HH:mm");
        ctx.answerCbQuery(answer, true);
      });
    } else if (btn == "factionCallback") {
      ctx.answerCbQuery("Refreshed Sortie");
      Util.getSortie(sortie => {
        Reply.sortie(ctx, sortie, 1);
      });
    } else if (btn == "infoCallback") {
      ctx.answerCbQuery("Select modifier");
      Reply.info(ctx);
    } else if (btn == "optionsCallback") {
      ctx.answerCbQuery("Select modifier");
      Reply.options(ctx);
    } else if (btn == "backCallback") {
      ctx.answerCbQuery("Loading Sortie!");
      Reply.dash(ctx, true);
    } else if (btn == "optinCallback") {
      ctx.answerCbQuery("Subscribed!");
      Reply.optIn(ctx);
      Reply.options(ctx);
    } else if (btn == "optoutCallback") {
      ctx.answerCbQuery("Unsubscribed!");
      Reply.optOut(ctx);
      Reply.options(ctx);
    } else if (btn == "clearCallback") {
      ctx.answerCbQuery("Cleared!");
      Reply.clear(ctx);
    } else if (btn == "removeItemCallback") {
      Reply.removeAlertItem(ctx);
    } else if (btn == "cancelCallback") {
      Reply.cancel(ctx);
    } else if (btn == "applyCallback") {
      ctx.answerCbQuery("Applied!");
      Reply.listAlert(ctx, true);
    } else if (btn.includes("showAllCallback")) {
      let type = btn.includes(".") ? [btn.split(".")[0]] : ["Alert"];
      ctx.answerCbQuery("Loading all alerts!");
      Reply.checkAlert(
        ctx.session.alertItems,
        userId,
        ctx,
        true,
        true,
        true,
        false,
        false,
        type
      );
    } else if (btn.includes("showFilterCallback")) {
      let type = btn.includes(".") ? [btn.split(".")[0]] : ["Alert"];
      ctx.answerCbQuery("Loading filtered " + type + "!");
      Reply.checkAlert(
        ctx.session.alertItems,
        userId,
        ctx,
        true,
        false,
        true,
        false,
        false,
        type
      );
    } else if (btn.includes("bossCallback")) {
      ctx.answerCbQuery("Your actions have consequences...", true);
    } else if (btn.includes("refreshAllAlertsCallback")) {
      let type = btn.includes(".") ? [btn.split(".")[0]] : ["Alert"];
      ctx.answerCbQuery("Refreshing " + type + "...");
      Reply.checkAlert(
        ctx.session.alertItems,
        userId,
        ctx,
        true,
        true,
        true,
        false,
        false,
        type
      );
    } else if (btn.includes("refreshAlertsCallback")) {
      let type = btn.includes(".") ? [btn.split(".")[0]] : ["Alert"];
      ctx.answerCbQuery("Refreshing filtered " + type + "...");
      Reply.checkAlert(
        ctx.session.alertItems,
        userId,
        ctx,
        true,
        false,
        true,
        false,
        false,
        type
      );
    } else if (btn == "filterCallback") {
      ctx.answerCbQuery("Loading filter!");
      Reply.listAlert(ctx, true);
    } else if (btn == "refreshDashCallback") {
      ctx.answerCbQuery("Refreshing!");
      Reply.dash(ctx, true);
    } else if (btn == "dashCallback") {
      ctx.answerCbQuery("Loading dashboard!");
      Reply.dash(ctx, true);
    } else if (btn == "cancelItemRemoveCallback") {
      ctx.answerCbQuery("Canceling!");
      Reply.listAlert(ctx, true);
    } else if (btn == "slapCallback") {
      ctx.answerCbQuery("Slap me harder daddy!");
      Reply.slap(ctx);
    } else if (btn == "moreCallback") {
      ctx.answerCbQuery("Showing More!");
      const buttons = {
        inline_keyboard: [
          [
            { text: "TRADER", callback_data: "traderCallback" },
            {
              text: "SEARCH",
              switch_inline_query_current_chat: ""
            },
            { text: "REFRESH", callback_data: "refreshDashCallback" }
          ],
          [
            { text: "SORTIE", callback_data: "factionCallback" },
            { text: "ALERTS", callback_data: "showAllCallback" }
          ],
          [
            { text: "MISSIONS", callback_data: "missionsCallback" },
            { text: "BOSSES", callback_data: "bossesCallback" },
            { text: "EVENTS", callback_data: "eventsCallback" }
          ],
          [
            { text: "LESS", callback_data: "lessCallback" },
            { text: "SETTINGS", callback_data: "optionsCallback" }
          ]
        ]
      };
      ctx.editMessageReplyMarkup(buttons);
    } else if (btn == "traderCallback") {
      ctx.answerCbQuery("Loading Trader...");
      Reply.trader(ctx, undefined, undefined, undefined, true);
    } else if (btn == "lessCallback") {
      ctx.answerCbQuery("Hiding Buttons!");
      const buttons = {
        inline_keyboard: [
          [
            { text: "ACTIONS", callback_data: "moreCallback" },
            { text: "REFRESH", callback_data: "refreshDashCallback" }
          ]
        ]
      };
      ctx.editMessageReplyMarkup(buttons);
    } else if (btn == "missionsCallback") {
      ctx.answerCbQuery("Loading Missions...");
      Reply.listMissions(ctx, true);
    } else if (btn == "bossesCallback") {
      ctx.answerCbQuery("Loading Bosses...");
      Reply.listBosses(ctx, true);
    } else if (btn == "eventsCallback") {
      ctx.answerCbQuery("Loading Events...");
      Reply.events(ctx, undefined, true);
    }
  },
  slap: ctx => {
    Util.slap();
    ctx.telegram.editMessageReplyMarkup(
      undefined,
      undefined,
      ctx.callbackQuery.inline_message_id,
      {
        inline_keyboard: [
          [
            {
              text: "SLAP | 👋 " + Util.slapped,
              callback_data: "slapCallback"
            }
          ]
        ]
      }
    );
  },
  clear: ctx => (ctx.session = null),
  optOut: ctx => {
    Util.addUser(ctx, false);
  },
  optIn: ctx => {
    Util.addUser(ctx, true);
  },
  sortie: (ctx, sortie, updateType, userId, bot) => {
    var message = "`>` *SORTIE* `<`\n\n";
    if (!sortie) return;
    if (!sortie.variants) {
      console.log(Util.getNow(), "Not responding");
      return;
    }
    if (sortie == null) return;
    const compressed = sortie.variants.map(v => {
      return { missionType: v.missionType, modifier: v.modifier };
    });
    /** generate message */
    const missionsMSG = compressed.reduce((str, s, i) => {
      return (
        str +
        (i + 1) +
        ". *" +
        (Util.isAssAss(s.missionType)
          ? s.missionType + " - " + sortie.boss
          : s.missionType) +
        "* \n`|`\t\t\t\t\t\t `" +
        (s.modifier.includes(":")
          ? s.modifier.split(":")[0] +
            "\n|\t\t\t\t\t\t" +
            s.modifier.split(":")[1]
          : s.modifier) +
        "` \n"
      );
    }, "");
    message += missionsMSG;
    times = [];
    compressed.forEach(c => {
      const type = c.missionType;
      data.sortieTimes.forEach(st => {
        if (st.type.toUpperCase() == type.toUpperCase()) {
          times.push(st.time);
        }
      });
    });
    const time = times.reduce((sum, time) => (sum += time));
    const timeMSG = time + " - " + (time + 4) + "m";

    const menu = Telegraf.Extra.markdown().markup(m =>
      m.inlineKeyboard([
        [
          m.callbackButton("INFO", "infoCallback"),
          m.callbackButton(sortie.faction, "factionCallback"),
          m.callbackButton(timeMSG, "timeCallback")
        ],
        [m.callbackButton("DASHBOARD", "dashCallback")]
      ])
    );

    switch (updateType) {
      case 1:
        ctx.editMessageText(message, menu).catch(err => {
          if (err.code != 400) console.log(err);
        });
        break;
      case 2:
        bot.telegram.sendMessage(userId, message, menu);
        break;
      default:
        ctx.replyWithMarkdown(message, menu);
        break;
    }
  },
  listMissions: (ctx, isEdit) => {
    Util.getSortieInfo(sortieInfo => {
      var missionsArr = [];

      Util.getAvgTimes(times => {
        Reply.listBosses(ctx, false, str => {
          sortieInfo.endStates.forEach(state => {
            state.regions.forEach(region => {
              region.missions.forEach(mission => {
                let ind = missionsArr.find(
                  m => m.mission.toUpperCase() == mission.toUpperCase()
                );
                if (!ind) {
                  var time = times.find(
                    t => t.mission.toUpperCase() == mission.toUpperCase()
                  );
                  if (!Util.isAssAss(mission)) {
                    missionsArr.push({
                      mission: mission,
                      time: time ? time.minutes + ":" + time.seconds : undefined
                    });
                  } else {
                    missionsArr.push({
                      mission: mission,
                      bosses: str
                    });
                  }
                }
              });
            });
          });
          var msg = missionsArr.reduce(
            (str, m) =>
              (str +=
                "\t-\t_" +
                m.mission +
                "_" +
                (m.time ? " `(" + m.time + ")`" : "") +
                (m.bosses
                  ? " \n`|`\t\t\t" + m.bosses.split("\n").join("\n`|`\t\t\t")
                  : "") +
                "\n"),
            "*MISSIONS:*\n"
          );
          var dashBtn = Telegraf.Extra.markdown().markup(m =>
            m.inlineKeyboard([[m.callbackButton("DASHBOARD", "dashCallback")]])
          );

          if (isEdit) {
            ctx.editMessageText(msg, dashBtn);
          } else {
            ctx.replyWithMarkdown(msg, dashBtn);
          }
        });
      });
    });
  },
  listBosses: (ctx, isEdit, Callback) => {
    Util.getSortieInfo(sortieInfo => {
      var bossesArr = [];
      Util.getAvgTimes(times => {
        sortieInfo.endStates.forEach(state => {
          if (!bossesArr.includes(state.bossName)) {
            var time = times.find(
              t =>
                t.boss
                  ? t.boss.toUpperCase() == state.bossName.toUpperCase()
                  : false
            );
            bossesArr.push({
              boss: state.bossName,
              time: time ? time.minutes + ":" + time.seconds : undefined
            });
          }
        });

        var msg = bossesArr.reduce(
          (str, m) =>
            (str +=
              "\t-\t_" +
              m.boss +
              "_" +
              (m.time ? " `(" + m.time + ")`" : "") +
              "\n"),
          "*BOSSES:*\n"
        );
        var dashBtn = Telegraf.Extra.markdown().markup(m =>
          m.inlineKeyboard([[m.callbackButton("DASHBOARD", "dashCallback")]])
        );
        if (Callback) {
          Callback(msg);
        } else if (isEdit) {
          ctx.editMessageText(msg, dashBtn);
        } else {
          ctx.replyWithMarkdown(msg, dashBtn);
        }
      });
    });
  },
  time: ctx => {
    if (!Util.isAdmin(ctx)) {
      ctx.replyWithMarkdown("You are not allowed to add times");
      return;
    }

    fs.readFile("./db/times.json", (err, timesRaw) => {
      if (err) {
        if (err.code == "ENOENT") {
          console.log(Util.getNow(), "No times found, creating new file");
        } else console.log(err);
      }
      let prevTimes = timesRaw ? JSON.parse(timesRaw) : [];

      const argStr = ctx.state.command.args;
      const args = argStr.split(",").map(a => a.trim());

      if (args.length > 1 && args.length < 4) {
        const mission = args[0];
        const time = args[1];
        const boss = args[2];

        if (Util.isAssAss(mission) && args.length == 2) {
          ctx.replyWithMarkdown(
            "Please add a boss name, use this format: \n" +
              "`/time <missionType>, <mm:ss> [, boss name]`\n" +
              "*<>: required*, []: optional\n_Don't forget the commas!_"
          );
          return;
        } else {
          Util.getSortieInfo(sortieInfo => {
            var possibleMissions = [];
            var possibleBosses = [];

            sortieInfo.endStates.forEach(state => {
              state.regions.forEach(region => {
                region.missions.forEach(actualMission => {
                  if (!possibleMissions.includes(actualMission.toUpperCase())) {
                    possibleMissions.push(actualMission.toUpperCase());
                  }
                });
              });
              if (!possibleBosses.includes(state.bossName.toUpperCase())) {
                possibleBosses.push(state.bossName.toUpperCase());
              }
            });

            const validMission = possibleMissions.includes(
              mission.toUpperCase()
            );
            const validTime = Util.parseTime(time);

            if (!validMission) {
              ctx.replyWithMarkdown("not a valid Mission: " + mission);
              return;
            } else if (!validTime) {
              ctx.replyWithMarkdown(
                "not a valid Time: " + time + ", use format mm:ss "
              );
              return;
            } else if (args.length == 3) {
              if (!possibleBosses.includes(boss.toUpperCase())) {
                ctx.replyWithMarkdown("not a valid Boss: " + boss);
                return;
              } else {
                Reply.addTime(ctx, prevTimes, mission, time, boss);
              }
            } else {
              Reply.addTime(ctx, prevTimes, mission, time);
            }
          });
        }
      } else {
        ctx.replyWithMarkdown(
          "*Not* a valid format, use this format:\n" +
            "`/time <missionType>, <mm:ss> [, boss name]`\n" +
            "*<>: required*, []: optional\n_Don't forget the commas!_"
        );
      }
    });
  },
  addTime: (ctx, prevTimes, mission, time, boss) => {
    if (!ctx || !prevTimes) return;

    const min = parseInt(time.split(":")[0]);
    const sec = parseInt(time.split(":")[1]);

    const newTime = {
      mission: mission,
      minutes: min,
      seconds: sec,
      boss: boss
    };

    prevTimes.push(newTime);

    let data = JSON.stringify(prevTimes, null, 2);

    fs.writeFile("./db/times.json", data, err => {
      if (err) console.log(err);
      console.log(Util.getNow(), "Data written to file");
      ctx.replyWithMarkdown(
        "Added *" +
          mission +
          "* mission with time *" +
          min +
          "m* and *" +
          sec +
          "s* to databse."
      );
    });
  },
  query: ctx => {
    if (ctx.inlineQuery.query == Reply.lastQuery) {
      Reply.queryCount++;
    } else {
      Reply.queryCount = 0;
    }
    Reply.lastQuery = ctx.inlineQuery.query;
    var extra = Util.getItems(ctx.inlineQuery.query);
    var offset = parseInt(ctx.inlineQuery.offset || 0) * Reply.queryCount;
    var inlineObjects = [];

    if (ctx.inlineQuery.query == "") {
      inlineObjects.push({
        type: "article",
        id: "searchitem",
        title: "Start typing to search!",
        description: "Search Warframes, weapons, drops, items and more...\n",
        input_message_content: {
          message_text: "Mission Failed, We'll Get 'Em Next Time",
          parse_mode: "Markdown"
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "GAME OVER",
                switch_inline_query_current_chat: ""
              }
            ]
          ]
        }
      });
    } else {
      extra.forEach((item, i) => {
        if (item.wikiaThumbnail) {
          inlineObjects.push({
            type: "photo",
            id: "p" + i,
            photo_url: item.wikiaThumbnail,
            thumb_url: item.wikiaThumbnail,
            title: item.name,
            description: item.type,
            input_message_content: {
              message_text: Util.translateItem(item),
              parse_mode: "Markdown"
            },
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "SEARCH NEW",
                    switch_inline_query_current_chat: ""
                  }
                ]
              ]
            }
          });
        } else {
          var description = item.description
            ? item.description.replace(/\<([^>]+)\>/g, "").replace(/[*`_]/g, "")
            : "";

          inlineObjects.push({
            type: "article",
            id: "a" + i,
            title: item.name,
            description: description,
            input_message_content: {
              message_text: Util.translateItem(item),
              parse_mode: "Markdown"
            },
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "SEARCH NEW",
                    switch_inline_query_current_chat: ""
                  }
                ]
              ]
            }
          });
        }
      });
    }
    if (inlineObjects.length < 1) {
      const gifs = [
        "https://i.imgur.com/X8Z1NwC.gif",
        "https://i.imgur.com/ARwMmsw.gif",
        "https://i.imgur.com/WjfSkSS.gif",
        "https://i.imgur.com/HxJXv3F.gif"
      ];
      var randGif = gifs[Math.floor(Math.random() * gifs.length)];
      inlineObjects.push({
        type: "gif",
        id: "valkyr",
        gif_url: randGif,
        thumb_url: randGif,
        title: "ASS",
        description: "NOICE",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "SLAP | 👋 " + Util.slapped,
                callback_data: "slapCallback"
              }
            ]
          ]
        }
      });
      inlineObjects.push({
        type: "article",
        id: "noitem",
        title: "No items found!",
        description: "Try another search query.",
        input_message_content: {
          message_text: "Try another search query.",
          parse_mode: "Markdown"
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "SEARCH",
                switch_inline_query_current_chat: ""
              }
            ]
          ]
        }
      });
    }
    ctx
      .answerInlineQuery(inlineObjects.slice(offset, offset + 50), {
        cache_time: 0,
        next_offset: 50
      })
      .catch(err => console.log(err));
    // });
  },
  cetus: (ctx, Callback) => {
    const url = "https://api.warframestat.us/pc/cetusCycle";
    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) console.log(err);
        if (!body || !Util.IsJsonString(body)) {
          Callback({});
          return;
        }
        if (Callback) {
          Callback(body);
        } else {
          ctx.replyWithMarkdown(body.shortString);
        }
      }
    );
  },
  trader: (ctx, Callback, userId, bot, isEdit) => {
    Util.getTrader(trader => {
      if (!trader) return;
      var message = Callback ? "" : "`>` *TRADER* `<`\n\n";
      if (trader.active) {
        message +=
          "_" +
          trader.endString +
          "_\n*Location*:\t\t`" +
          trader.location +
          "`\n";
        if (!Callback) {
          message += trader.inventory.reduce(
            (str, t) =>
              (str +=
                "\t\t\t-\t_" +
                t.item +
                "_ `(" +
                t.ducats +
                "d, " +
                t.credits +
                "cr)`\n"),
            ""
          );
        }
      } else {
        message +=
          "_" +
          trader.startString +
          "_\n*Will be at*:\t\t`" +
          trader.location +
          "`\n";
      }
      var dashBtn = Telegraf.Extra.markdown().markup(m =>
        m.inlineKeyboard([[m.callbackButton("DASHBOARD", "dashCallback")]])
      );
      if (Callback) {
        Callback({ message: message, trader: trader });
      } else if (userId && bot) {
        bot.telegram.sendMessage(userId, message, dashBtn);
      } else if (isEdit) {
        ctx.editMessageText(message, dashBtn);
      } else {
        ctx.replyWithMarkdown(message, dashBtn);
      }
    });
  },
  events: (ctx, Callback, isEdit) => {
    Util.getEvents(events => {
      const msg = events.reduce(
        (str, e) =>
          (str +=
            "*" +
            e.tooltip.replace("Tool Tip", "") +
            "*" +
            "\n\t\t\t_Ends " +
            moment(e.expiry).fromNow() +
            "_\n\t\t\t\t\t\t" +
            e.description +
            ": `" +
            (e.node ? e.node : e.health ? e.health : "") +
            "`" +
            (e.rewards.length > 0
              ? "\n\t\t\t\t\t\t" + e.rewards.join(" - ")
              : "\n")),
        ""
      );
      var dashBtn = Telegraf.Extra.markdown().markup(m =>
        m.inlineKeyboard([[m.callbackButton("DASHBOARD", "dashCallback")]])
      );
      if (Callback) {
        Callback(msg);
      } else if (isEdit) {
        ctx.editMessageText(msg, dashBtn);
      } else {
        ctx.replyWithMarkdown(msg, dashBtn);
      }
    });
  },
  dash: (ctx, isRefresh) => {
    var msg = ".`>` *DASHBOARD* `<`\n\n";
    const buttons = Telegraf.Extra.markdown().markup(m =>
      m.inlineKeyboard([
        [
          m.callbackButton("ACTIONS", "moreCallback"),
          m.callbackButton("REFRESH", "refreshDashCallback")
        ]
      ])
    );
    if (isRefresh) {
      ctx.editMessageText(
        Util.formatMessage(msg),
        Telegraf.Extra.markdown().markup(m =>
          m.inlineKeyboard([[m.callbackButton("Loading Sortie...", "nothing")]])
        )
      );

      /** SORTIE */
      Util.getSortie(sortie => {
        if (sortie) {
          msg +=
            ".*Sortie*:\n" +
            "_" +
            sortie.eta +
            "_\n" +
            sortie.variants.reduce(
              (str, m) =>
                (str +=
                  "*" +
                  m.missionType +
                  "*:\n\t\t\t\t`" +
                  (m.modifier.includes(":")
                    ? m.modifier.split(":")[0] +
                      "`\n\t\t\t\t`" +
                      m.modifier.split(":")[1]
                    : m.modifier) +
                  "`\n"),
              ""
            );
        }

        ctx.editMessageText(
          Util.formatMessage(msg),
          Telegraf.Extra.markdown().markup(m =>
            m.inlineKeyboard([
              [m.callbackButton("Loading Event information...", "nothing")]
            ])
          )
        );

        /** EVENTS */
        Reply.events(ctx, eventsMsg => {
          if (eventsMsg) {
            msg += "\n.*Events*:\n" + eventsMsg;
          }

          ctx.editMessageText(
            Util.formatMessage(msg),
            Telegraf.Extra.markdown().markup(m =>
              m.inlineKeyboard([
                [m.callbackButton("Loading Cetus information...", "nothing")]
              ])
            )
          );

          /** CETUS */
          Reply.cetus(ctx, cetus => {
            if (cetus) {
              msg +=
                "\n.*Cetus*:\n" +
                "_" +
                cetus.timeLeft +
                "_\n" +
                "*Time*: " +
                (cetus.isDay ? "`Day`" : "`Night`") +
                "\n";
            }
            ctx.editMessageText(
              Util.formatMessage(msg),
              Telegraf.Extra.markdown().markup(m =>
                m.inlineKeyboard([
                  [m.callbackButton("Loading Trader information...", "nothing")]
                ])
              )
            );

            /** TRADER */
            Reply.trader(ctx, trader => {
              if (trader) {
                msg +=
                  "\n.*" + trader.trader.character + "*:\n" + trader.message;
              }
              ctx.editMessageText(
                Util.formatMessage(msg),
                Telegraf.Extra.markdown().markup(m =>
                  m.inlineKeyboard([
                    [m.callbackButton("Loading Alerts...", "nothing")]
                  ])
                )
              );

              /** ALERTS */
              try {
                Reply.checkAlert(
                  ctx.session.alertItems,
                  isRefresh ? ctx.callbackQuery.from.id : ctx.from.id,
                  ctx,
                  true,
                  false,
                  false,
                  true,
                  alertMsg => {
                    if (alertMsg) {
                      msg += "\n.*Alerts*:\n" + alertMsg;
                    }

                    ctx
                      .editMessageText(Util.formatMessage(msg), buttons)
                      .catch(err => {
                        console.log(err);
                      });
                  }
                );
              } catch (err) {
                msg += "\n.*Alerts*:\nCould not load alerts...";

                ctx
                  .editMessageText(Util.formatMessage(msg), buttons)
                  .catch(err => {
                    console.log(err);
                  });
              }
            });
          });
        });
      });
    } else {
      ctx
        .replyWithMarkdown(
          Util.formatMessage(msg),
          Telegraf.Extra.markdown().markup(m =>
            m.inlineKeyboard([
              [m.callbackButton("Loading Sortie...", "nothing")]
            ])
          )
        )
        .then(m => {
          /** SORTIE */
          Util.getSortie(sortie => {
            if (sortie) {
              msg +=
                ".*Sortie*:\n" +
                "_" +
                sortie.eta +
                "_\n" +
                sortie.variants.reduce(
                  (str, m) =>
                    (str +=
                      "*" +
                      m.missionType +
                      "*:\n\t\t\t\t`" +
                      (m.modifier.includes(":")
                        ? m.modifier.split(":")[0] +
                          "`\n\t\t\t\t`" +
                          m.modifier.split(":")[1]
                        : m.modifier) +
                      "`\n"),
                  ""
                );
            }

            ctx.telegram.editMessageText(
              m.chat.id,
              m.message_id,
              undefined,
              Util.formatMessage(msg),
              Telegraf.Extra.markdown().markup(m =>
                m.inlineKeyboard([
                  [m.callbackButton("Loading Event information...", "nothing")]
                ])
              )
            );

            /** EVENTS */
            Reply.events(ctx, eventsMsg => {
              if (eventsMsg) {
                msg += "\n.*Events*:\n" + eventsMsg;
              }

              ctx.telegram.editMessageText(
                m.chat.id,
                m.message_id,
                undefined,
                Util.formatMessage(msg),
                Telegraf.Extra.markdown().markup(m =>
                  m.inlineKeyboard([
                    [
                      m.callbackButton(
                        "Loading Cetus information...",
                        "nothing"
                      )
                    ]
                  ])
                )
              );

              /** CETUS */
              Reply.cetus(ctx, cetus => {
                if (cetus) {
                  msg +=
                    "\n.*Cetus*:\n" +
                    "_" +
                    cetus.timeLeft +
                    "_\n" +
                    "*Time*: " +
                    (cetus.isDay ? "`Day`" : "`Night`") +
                    "\n";
                }
                ctx.telegram.editMessageText(
                  m.chat.id,
                  m.message_id,
                  undefined,
                  Util.formatMessage(msg),
                  Telegraf.Extra.markdown().markup(m =>
                    m.inlineKeyboard([
                      [
                        m.callbackButton(
                          "Loading Trader information...",
                          "nothing"
                        )
                      ]
                    ])
                  )
                );

                /** TRADER */
                Reply.trader(ctx, trader => {
                  if (trader) {
                    msg +=
                      "\n.*" +
                      trader.trader.character +
                      "*:\n" +
                      trader.message;
                  }

                  ctx.telegram.editMessageText(
                    m.chat.id,
                    m.message_id,
                    undefined,
                    Util.formatMessage(msg),
                    Telegraf.Extra.markdown().markup(m =>
                      m.inlineKeyboard([
                        [m.callbackButton("Loading Alerts...", "nothing")]
                      ])
                    )
                  );

                  /** ALERTS */
                  try {
                    Reply.checkAlert(
                      ctx.session.alertItems,
                      isRefresh ? ctx.callbackQuery.from.id : ctx.from.id,
                      ctx,
                      true,
                      false,
                      false,
                      true,
                      alertMsg => {
                        if (alertMsg) {
                          msg += "\n.*Alerts*:\n" + alertMsg;
                        }
                        ctx.telegram.editMessageText(
                          m.chat.id,
                          m.message_id,
                          undefined,
                          Util.formatMessage(msg),
                          buttons
                        );
                      }
                    );
                  } catch (err) {
                    msg += "\n.*Alerts*:\nCould not load alerts...";
                    if (isRefresh) {
                      ctx
                        .editMessageText(Util.formatMessage(msg), buttons)
                        .catch(err => {
                          console.log(err);
                        });
                    } else {
                      ctx.replyWithMarkdown(Util.formatMessage(msg), buttons);
                    }
                  }
                });
              });
            });
          });
        });
    }
  },
  bounties: (ctx, Callback) => {
    Util.getBounties(bounty => {
      var title = "*BOUNTIES:*\n";
      var expiry = "_" + bounty.eta + "_\n";
      if (bounty.jobs) {
        var jobMsg = bounty.jobs.reduce((str, job) => {
          return (str +=
            "*" +
            job.type +
            ":*\n`\t\t\t" +
            job.rewardPool.join(",\n\t\t\t") +
            "`\n");
        }, "");

        if (Callback) {
          Callback(title + expiry + jobMsg);
        } else {
          ctx.replyWithMarkdown(title + expiry + jobMsg);
        }
      }
    });
  },
  drops: ctx => {
    const itemsStr = ctx.state.command.args;
    ctx.replyWithMarkdown(
      "Use _inline mode_ to start searching for *Warframes, Weapons and Items*: \n`" +
        itemsStr +
        "`",
      Telegraf.Extra.markdown().markup(m =>
        m.inlineKeyboard([
          [m.switchToCurrentChatButton("START SEARCH", itemsStr)]
        ])
      )
    );
  }
};

module.exports = Reply;
