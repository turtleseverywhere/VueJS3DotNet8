﻿import * as signalR from '@microsoft/signalr';
import { Auth } from '@/auth/auth';
import constantValues from '@/common/constantValues';
//questo è per salvare il connectionId nel localstorage
import { useSignalRStore } from '@/stores/signalr';
import { useNotificationsStore } from '@/stores/notifications';
import { useMessage } from 'naive-ui';
import { Api } from '@/api/api';
import { useI18n } from 'vue-i18n';

export class SignalR {
    private static initialSignalRConnectionInterval: number = 0;
    private static signalRConnection: any = null;
    private static signalRStore: any = null;
    private static notificationsStore: any = null;
    //private static message: any = null;
    //private static t: any = null;

    static startSignalR() {
        this.signalRStore = useSignalRStore();
        this.notificationsStore = useNotificationsStore();
        //this.message = useMessage();
        //this.t = useI18n();

        //console.log("signalrconnection", this.signalRConnection);
        if (!this.signalRConnection) {
            //this.stateService.getConfig()
            //    .pipe(takeUntil(this.subscriptions))
            //    .subscribe({
            //        next: (config => {
            //            //console.log("config", config);
            //            if (config && config.backendUrl) {
            //                this.backendUrl = config.backendUrl;
            this.buildSignalRConnection();
            //        }
            //    }),
            //    error: (error => {
            //        this.logger.error(error);
            //    })
            //});
        }
        else
            this.connectSignalR();
    }

    private static buildSignalRConnection() {
        if (!this.signalRConnection) {
            this.signalRConnection = new signalR.HubConnectionBuilder()
                .withUrl(constantValues.backendUrl + "signalRHub"
                    //, {
                    //  httpClient: new CustomHTTPClient(new CustomLogger()),
                    //  //  logMessageContent: true
                    //}
                )
                .configureLogging(signalR.LogLevel.Information)
                //.withAutomaticReconnect([0, 2000, 10000, 10000, 10000, 10000, 10000, 10000, 30000, 30000, 30000])
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: context => {
                        const retryTimes = [0, 2000, 10000, 10000, 10000, 10000, 10000, 10000, 30000, 30000, 30000];
                        const index = context.previousRetryCount < retryTimes.length ? context.previousRetryCount : retryTimes.length - 1;
                        this.handleSignalRError(context.retryReason);
                        //console.log(context);
                        return retryTimes[index];
                    }
                })
                .build();

            this.signalRConnection.onclose(async (error: any) => {
                console.log("onclose", error);
                this.handleSignalRError(error);
            });

            this.signalRConnection.onreconnecting((error: any) => {
                //console.assert(this.signalRConnection.state === signalR.HubConnectionState.Reconnecting);
                console.log("onreconnecting", error);
                this.handleSignalRError(error);
            });

            this.signalRConnection.onreconnected((connectionId: any) => {
                console.log("new Connection ID:", connectionId);
                this.signalRConnection.invoke("RegisterClientConnection", this.signalRStore.getCachedSignalRConnectionId())
                    .then((result: any) => {
                        //console.log(result);
                        this.signalRStore.setCachedSignalRConnectionId(this.signalRConnection.connectionId);
                        /*va a prendere eventuali notifiche che sono arrivate nel frattempo*/
                        //this.getNotifications();
                    });
            });

            this.signalRConnection.on("ReceiveMessage", async (data: any) => {
                console.log("Received message from SignalR:", data);
                this.notificationsStore.setHasNotifications(true);
            });
        }
        if (this.signalRConnection)
            this.connectSignalR();
    }

    private static connectSignalR() {
        this.initialSignalRConnectionInterval = setInterval(
            async () => {
                if (this.signalRConnection.state === signalR.HubConnectionState.Disconnected) {
                    console.log("trying initial connection..");
                    await this.signalRConnection.start().then(() => {
                        console.log("SignalR connected");

                        if (this.signalRStore.getCachedSignalRConnectionId() == '')
                            this.signalRStore.setCachedSignalRConnectionId(this.signalRConnection.connectionId);

                        this.signalRConnection.invoke("RegisterClientConnection", this.signalRStore.getCachedSignalRConnectionId())
                            .then((result: any) => {
                                //console.log(result);
                                this.signalRStore.setCachedSignalRConnectionId(this.signalRConnection.connectionId);
                                /*va a prendere le notifiche iniziali*/
                                //this.getNotifications();
                            });
                    }).catch((error: any) => {
                        console.log("start", error);
                        this.handleSignalRError(error);
                    });
                }
                else {
                    clearInterval(this.initialSignalRConnectionInterval);
                }
            }, 5000);
    }

    private static handleSignalRError(error: Error | undefined) {
        if (error) {
            console.log(error);
            if (error.message.toLowerCase().includes("unauthorized")
                || error.message.includes("401")) {
                this.stopSignalR();
                clearInterval(this.initialSignalRConnectionInterval);
                Auth.logout();
            };
        }
    }

    static stopSignalR() {
        if (this.signalRConnection) {
            //console.log("stopping connection !");
            this.signalRConnection.stop();
        }
        //if (this.initialSignalRConnectionInterval) {
        //console.log("clearing interval !");
        clearInterval(this.initialSignalRConnectionInterval);
        //}
    }

    private static getNotifications() {
        Api.getNotifications().then((response: any) => {
            console.log(response);
            if (response.data.notifications.length > 0)
                this.notificationsStore.setHasNotifications(true);
        }).catch((error: any) => {
            //this.message.error(this.t('error'));
        }).then(() => {
        });
    }
}