package it.risto.rear;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;

/** Avvia il ponte e mostra l'ultima scena ricevuta. Nessuna configurazione da fare qui. */
public class MainActivity extends Activity {
    private TextView status;
    private Button toggle;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            refresh();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        if (RearState.isEnabled(this)) BridgeService.start(this);

        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad * 2, pad, pad);
        root.setBackgroundColor(Color.parseColor("#121212"));

        TextView title = new TextView(this);
        title.setText("Girasole Rear");
        title.setTextColor(Color.parseColor("#CFA055"));
        title.setTextSize(28);
        root.addView(title);

        TextView info = new TextView(this);
        info.setText("Ponte su 127.0.0.1:" + BridgeService.PORT + ". Spegnilo quando non usi il gestionale "
            + "(anche dalla notifica): niente notifica fissa né consumi. Si riaccende da qui.\n\n"
            + "Nel gestionale: Impostazioni > Display > Schermo posteriore > Card OuterView.\n\n"
            + "Perché HyperOS non lo chiuda: Risparmio batteria = Nessuna restrizione e Avvio automatico attivo.");
        info.setTextColor(Color.LTGRAY);
        info.setTextSize(15);
        info.setPadding(0, pad / 2, 0, pad);
        root.addView(info);

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(18);
        root.addView(status);

        toggle = new Button(this);
        toggle.setOnClickListener(v -> {
            if (RearState.isEnabled(this)) BridgeService.stop(this); else BridgeService.start(this);
            refresh();
        });
        root.addView(toggle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        Button settings = new Button(this);
        settings.setText("Impostazioni app (batteria / avvio automatico)");
        settings.setOnClickListener(v -> startActivity(
            new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = pad;
        root.addView(settings, lp);

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        super.onPause();
    }

    private void refresh() {
        toggle.setText(RearState.isEnabled(this) ? "Spegni ponte" : "Accendi ponte");
        JSONObject s = RearState.read(this);
        long at = s.optLong("updated_at");
        String when = at == 0 ? "mai ricevuta" : DateFormat.getTimeInstance().format(new Date(at));
        status.setText("Ultima scena (" + when + "):\n\n"
            + s.optString("top") + "\n" + s.optString("main") + "\n" + s.optString("bottom"));
    }
}
