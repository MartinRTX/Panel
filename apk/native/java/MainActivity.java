package com.martinrtx.panel;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Actividad principal: registra el plugin propio de Panel (abrir tus APK de Gym y Finanzas).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PanelPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
