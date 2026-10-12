package it.risto.rear;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Riavvia il ponte dopo il riavvio del telefono o un aggiornamento dell'app, se non è stato spento. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        boolean boot = Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a);
        if (boot && RearState.isEnabled(ctx)) {
            BridgeService.start(ctx);
        }
    }
}
