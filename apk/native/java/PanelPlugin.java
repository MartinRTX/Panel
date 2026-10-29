package com.martinrtx.panel;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Puente entre la app web y lo nativo: los botones rápidos abren tu APK de Gym o de Finanzas;
// si no está instalada, abren su página en el navegador (nunca dentro de Panel).
@CapacitorPlugin(name = "Panel")
public class PanelPlugin extends Plugin {

    @PluginMethod
    public void abrirApp(PluginCall call) {
        String paquete = call.getString("paquete", "");
        String url = call.getString("url", "");
        String extra = call.getString("extra", null);
        String valor = call.getString("valor", null);
        JSObject r = new JSObject();
        try {
            Intent i = paquete.isEmpty() ? null : getContext().getPackageManager().getLaunchIntentForPackage(paquete);
            if (i != null) {
                // Por ejemplo finanzas_accion=gasto: la app Finanzas abre directo el registro de gasto
                if (extra != null && valor != null) i.putExtra(extra, valor);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(i);
                r.put("abierta", "apk");
            } else {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                r.put("abierta", "web");
            }
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudo abrir: " + e.getMessage());
        }
    }
}
