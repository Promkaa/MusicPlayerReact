'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';

const HLS_CONFIG = {
    maxBufferLength: 15,          // Максимальная длина буфера в секундах (меньше - быстрее старт)
    maxMaxBufferLength: 30,       // Абсолютный максимум буфера
    maxBufferSize: 30 * 1000000,  // 30MB максимум данных в буфере
    abrBandWidthUpFactor: 0.5,    // Плавное повышение качества (избегает скачков)
    fragLoadingMaxRetry: 6,       // Количество повторных попыток при загрузке фрагмента
    manifestLoadingMaxRetry: 4,   // Количество повторных попыток при загрузке манифеста
};

const HLSPlayer = forwardRef(({ src, poster, autoPlay = false }, ref) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    useImperativeHandle(ref, () => videoRef.current);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        const destroyHls = () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };

        if (Hls.isSupported()) {
            destroyHls();

            const hls = new Hls(HLS_CONFIG);
            hlsRef.current = hls;

            hls.loadSource(src);
            hls.attachMedia(video);

            if (autoPlay) {
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(e => console.log('Автовоспроизведение заблокировано:', e));
                });
            }

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.warn('Сетевая ошибка, попытка восстановления...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.warn('Медиа-ошибка, попытка восстановления...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('Неустранимая ошибка, пересоздание плеера');
                            destroyHls();
                            break;
                    }
                }
            });
        }
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            if (autoPlay) video.play().catch(e => console.log('Автовоспроизведение заблокировано:', e));
        }

        return destroyHls;
    }, [src, autoPlay]);

    return (
        <video
            ref={videoRef}
            poster={poster}
            className="hls-player"
            style={{ width: '100%', maxWidth: '100%' }}
            playsInline
        />
    );
});

HLSPlayer.displayName = 'HLSPlayer';

export default HLSPlayer;