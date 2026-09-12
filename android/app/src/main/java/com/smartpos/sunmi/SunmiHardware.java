package com.smartpos.sunmi;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.IBinder;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Method;

public final class SunmiHardware {
    private static final String[] SCANNER_ACTIONS = {
            "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED",
            "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED2"
    };
    private static final String[] SCANNER_KEYS = {
            "data", "decode_data", "barcode", "content"
    };

    private final Context context;
    private final WebView webView;
    private final BroadcastReceiver scannerReceiver;
    private Object printerService;
    private boolean receiverRegistered;

    public SunmiHardware(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
        scannerReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String value = null;
                for (String key : SCANNER_KEYS) {
                    value = intent.getStringExtra(key);
                    if (value != null && !value.isEmpty()) break;
                }
                if (value != null) dispatchScanner(value);
            }
        };
    }

    public void registerScannerReceiver() {
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter();
        for (String action : SCANNER_ACTIONS) filter.addAction(action);
        context.registerReceiver(scannerReceiver, filter);
        receiverRegistered = true;
        bindPrinterService();
    }

    public void unregisterScannerReceiver() {
        if (!receiverRegistered) return;
        context.unregisterReceiver(scannerReceiver);
        receiverRegistered = false;
    }

    private void dispatchScanner(String value) {
        String escaped = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n");
        webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('smartpos:scan', {detail: {value: '" + escaped + "'}}));", null));
    }

    private void bindPrinterService() {
        Intent intent = new Intent();
        intent.setPackage("com.sunmi.extprinterservice");
        intent.setAction("woyou.aidl.service");
        context.bindService(intent, new ServiceConnection() {
            @Override public void onServiceConnected(ComponentName name, IBinder service) {
                try {
                    Class<?> stub = Class.forName("woyou.aidlservice.jiuiv5.IWoyouService$Stub");
                    Method asInterface = stub.getMethod("asInterface", IBinder.class);
                    printerService = asInterface.invoke(null, service);
                } catch (Exception ignored) {
                    printerService = null;
                }
            }
            @Override public void onServiceDisconnected(ComponentName name) { printerService = null; }
        }, Context.BIND_AUTO_CREATE);
    }

    @JavascriptInterface
    public void printText(String text) {
        if (printerService == null) return;
        try {
            Method method = findPrinterMethod("printText", String.class, Object.class);
            if (method != null) {
                method.invoke(printerService, text, null);
                return;
            }
            Method legacy = findPrinterMethod("printText", String.class);
            if (legacy != null) {
                legacy.invoke(printerService, text);
            }
        } catch (Exception ignored) { }
    }

    @JavascriptInterface
    public void printImage(String base64Image) {
        if (printerService == null || base64Image == null || base64Image.isEmpty()) return;

        try {
            byte[] bytes = Base64.decode(base64Image, Base64.DEFAULT);
            if (bytes.length == 0) return;

            Bitmap bitmap = BitmapFactory.decodeStream(new ByteArrayInputStream(bytes));
            if (bitmap == null) return;

            Method method = findPrinterMethod("printBitmap", Bitmap.class, int.class, int.class);
            if (method != null) {
                method.invoke(printerService, bitmap, 0, 0);
                return;
            }

            Method legacy = findPrinterMethod("printBitmap", Bitmap.class);
            if (legacy != null) {
                legacy.invoke(printerService, bitmap);
            }
        } catch (Exception ignored) {
        }
    }

    @JavascriptInterface
    public boolean isPrinterConnected() {
        return printerService != null;
    }

    private Method findPrinterMethod(String name, Class<?>... parameterTypes) {
        if (printerService == null) return null;
        Class<?> clazz = printerService.getClass();
        try {
            return clazz.getMethod(name, parameterTypes);
        } catch (NoSuchMethodException ignored) {
            return null;
        }
    }
}
