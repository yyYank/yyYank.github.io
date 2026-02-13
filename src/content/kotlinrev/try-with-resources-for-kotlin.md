---
title: "Kotlinでtry-with-resourcesが使いたい"
description: "逆引きKotlin: Kotlinでtry-with-resourcesが使いたい"
order: 34
---



# Kotlinでtry-with-resourcesが使いたい 



useを使います。

    val inputStream = Thread.currentThread().contextClassLoader.getResourceAsStream("hogehoge")
    java.io.InputStreamReader(inputStream).use {
        // `it`がInputStreamReaderのインスタンス
        val b = it.read()
    }


useはClosableインターフェースを実装しているクラスの拡張関数として提供されています。
したがってcloseが実装されているクラスには同じように適用できます。

[https://kotlinlang.org/api/latest/jvm/stdlib/kotlin.io/use.html](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin.io/use.html)


最終更新日時：2018年4月18日
