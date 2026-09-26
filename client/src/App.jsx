import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const localHosts = ['localhost', '127.0.0.1'];
const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.trim();
const configuredServerHost = configuredServerUrl
    ? new URL(configuredServerUrl, window.location.origin).hostname
    : '';
const useConfiguredServer = configuredServerUrl && (
    !localHosts.includes(window.location.hostname) && !localHosts.includes(configuredServerHost)
);
const SERVER_URL = useConfiguredServer ? configuredServerUrl : window.location.origin;
const defaultVideo = 'https://youtu.be/3LRZRSIh_KE?si=ipvDtNTWH2o674-j';
const socket = io(SERVER_URL, { autoConnect: false });

function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    return new Promise((resolve) => {
        const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
        if (!existing) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            document.body.appendChild(script);
        }
    });
}

function App() {
    const [view, setView] = useState(location.pathname.startsWith('/room/') ? 'join' : 'home');
    const [roomId, setRoomId] = useState(location.pathname.split('/')[2] || '');
    const [form, setForm] = useState({ username: '', password: '', videoUrl: defaultVideo, joinCode: roomId });
    const [room, setRoom] = useState(null);
    const [userId, setUserId] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        socket.on('connect_error', () => setError('Unable to reach the watch party server. Start both app services with npm run dev from the project root, or open the deployed app URL.'));
        socket.on('error', ({ message }) => setError(message));

        socket.on('room_created', ({ roomId: createdRoomId, userId: hostId, state }) => 
            {
            setRoomId(createdRoomId); 
            setUserId(hostId); 
            setRoom(state); 
            setView('room'); 
            history.pushState({}, '', `/room/${createdRoomId}`);
        });

        socket.on('room_state', ({ userId: joinedId, state }) =>
             {
            setUserId(joinedId); 
            setRoom(state); 
            setView('room'); 
            history.pushState({}, '', `/room/${state.roomId}`);
        });

        socket.on('sync_state', state => setRoom(previous => ({ ...previous, ...state })));

        socket.on('participants_updated', ({ participants }) =>
            setRoom(previous => previous ? { ...previous, participants } : previous));

        socket.on('role_assigned', ({ userId: changedId, role }) => setRoom(previous => previous ? { ...previous, participants: previous.participants.map(participant => participant.userId === changedId ? { ...participant, role } : participant) } : previous));

        socket.on('video_changed', ({ videoId }) =>
            setRoom(previous => previous ? { ...previous, videoId, playbackState: 'PAUSED', currentTime: 0 } : previous));

        socket.on('playback_updated', update =>
            setRoom(previous => previous ? { ...previous, playbackState: update.action === 'play' ? 'PLAYING' : update.action === 'pause' ? 'PAUSED' : previous.playbackState, currentTime: update.currentTime ?? update.time ?? previous.currentTime } : previous));

        socket.on('participant_removed', () => { socket.disconnect(); setRoom(null); setError('You were removed from this room.'); setView('home'); history.pushState({}, '', '/'); });

        return () => { socket.removeAllListeners(); socket.disconnect(); };
    }, []);

    const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

    const createRoom = event => {
         event.preventDefault();
          setError(''); 
          socket.connect(); 
          socket.emit('create_room', { username: form.username, password: form.password, videoId: form.videoUrl }); };

    const joinRoom = event => { event.preventDefault(); setError(''); socket.connect(); socket.emit('join_room', { roomId: form.joinCode, username: form.username }); };

    const leaveRoom = () => { 
        socket.emit('leave_room', { roomId });
         socket.disconnect();
          setRoom(null); 
          setView('home');
           history.pushState({}, '', '/'); };

    if (view === 'room' && room) 
        return <RoomView room={room} userId={userId} socket={socket} onLeave={leaveRoom} />;
       return <Landing view={view} setView={setView} form={form} update={update} createRoom={createRoom} joinRoom={joinRoom} error={error} />;
}

function Landing({ view, setView, form, update, createRoom, joinRoom, error }) {
    return <main className="landing">
        <nav>
            <div className="brand">
                <span className="brand-mark">
                </span> YT Watch Party</div>
            <span className="nav-note">Synchronized viewing, made simple</span>
        </nav>

        <section className="hero">

            <div className="eyebrow">REAL-TIME VIDEO ROOMS</div>
            <h1>Press play.<br /><em>Stay together.</em></h1>
            <p className="hero-copy">A shared room for YouTube, built for the moments that are better when everyone sees them at once.</p>
            <div className="hero-actions">
                <button className="primary" onClick={() => setView('create')}>Create a room <span>↗</span></button>
                <button className="secondary" onClick={() => setView('join')}>Join with a code</button>
            </div>

            <div className="feature-strip">
                <div>
                    <strong>01</strong>
                    <span>One shared timeline</span>
                </div>

                <div>
                    <strong>02</strong>
                    <span>Roles that keep order</span>
                </div>

                <div>
                    <strong>03</strong>
                    <span>Everyone stays in sync</span>
                </div>

            </div>

        </section>
        {(view === 'create' || view === 'join') && <div className="modal-backdrop">

            <form className="form-card" onSubmit={view === 'create' ? createRoom : joinRoom}>

                
        <button type="button" className="close" onClick={() => setView('home')}>× </button>

                <div className="eyebrow">
                    {view === 'create' ? 'NEW WATCH PARTY' : 'ENTER THE ROOM'}
                </div>

                <h2>
                    {view === 'create' ? 'Set the room in motion.' : 'You’re invited in.'}
                </h2>
                
                <p className="muted">{view === 'create' ? 'You’ll be the host. Add a password so only you can manage the room.' : 'Use the room code shared by your host.'}</p>

                <label>Your name<input required value={form.username} onChange={event => update('username', event.target.value)}
                    placeholder="e.g. Harshit" />
                 </label>{view === 'create' ? 
                 <>
                    <label>Host password<input required minLength="6" type="password" value={form.password}
                        onChange={event => update('password', event.target.value)} placeholder="At least 6 characters" />
                    </label>
                    <label>Starting video <span className="optional">optional</span>
                        <input value={form.videoUrl} onChange={event => update('videoUrl', event.target.value)} placeholder="Paste a YouTube URL" />
                    </label>

                </>   : <label>
                    Room code
                    <input required value={form.joinCode} onChange={event => update('joinCode', event.target.value.toUpperCase())} placeholder="ABC1234" />
                </label>
                }{error && <div className="error">{error}</div>}<button className="primary wide" type="submit">{view === 'create' ? 'Create watch party' : 'Join watch party'} <span>→</span></button></form></div>}
    </main>;
}


function RoomView({ room, userId, socket, onLeave }) {
    const playerRef = useRef(null);
    const playerContainer = useRef(null);
    const applyingRemote = useRef(false);
     const [videoUrl, setVideoUrl] = useState('');

    const [notice, setNotice] = useState('');
     const [duration, setDuration] = useState(0);

    const currentUser = room.participants.find(participant => participant.userId === userId);

    const canControl = currentUser?.role === 'HOST';
    const isHost = currentUser?.role === 'HOST';


    function syncRoom(state) {
        if (!playerRef.current) return;
        applyingRemote.current = true;
        playerRef.current.seekTo(state.currentTime || 0, true);
        if (state.playbackState === 'PLAYING') playerRef.current.playVideo();
        setTimeout(() => { applyingRemote.current = false; }, 500);
    }


    useEffect(() => {
        let active = true;
        loadYouTubeApi().then(YT => {
            if (!active || !playerContainer.current)
                return;
            playerRef.current = new YT.Player(playerContainer.current, {
                videoId: room.videoId,
                playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0 },
                events: {
                    onReady: () => {
                        setDuration(playerRef.current.getDuration());
                        syncRoom(room);
                    },

                    onStateChange: event => {
                        if (applyingRemote.current || !canControl) return;
                        if (event.data === YT.PlayerState.PLAYING) socket.emit('play', { roomId: room.roomId, currentTime: playerRef.current.getCurrentTime() });
                        if (event.data === YT.PlayerState.PAUSED) socket.emit('pause', { roomId: room.roomId, currentTime: playerRef.current.getCurrentTime() });
                    }
                }
            });
        });
        return () => { active = false; playerRef.current?.destroy(); };

    }, [room.videoId, canControl]);

    useEffect(() => {
        const handler = update => {
            if (!playerRef.current) return; applyingRemote.current = true;
            if (update.action === 'play') { playerRef.current.seekTo(update.currentTime || 0, true); playerRef.current.playVideo(); }
            if (update.action === 'pause') { playerRef.current.seekTo(update.currentTime || 0, true); playerRef.current.pauseVideo(); }
            if (update.action === 'seek') playerRef.current.seekTo(update.time, true); setTimeout(() => {
                applyingRemote.current = false;
            }, 400);
        };
    socket.on('playback_updated', handler); return () => socket.off('playback_updated', handler);
    }, [socket]);

    const changeVideo = event => { event.preventDefault(); if (videoUrl.trim()) socket.emit('change_video', { roomId: room.roomId, videoId: videoUrl }); setVideoUrl(''); };
    const togglePlayback = () => {
        if (!canControl || !playerRef.current) return;
        if (room.playbackState === 'PLAYING') {
            playerRef.current.pauseVideo();
            socket.emit('pause', { roomId: room.roomId, currentTime: playerRef.current.getCurrentTime() });
        } else {
            playerRef.current.playVideo();
            socket.emit('play', { roomId: room.roomId, currentTime: playerRef.current.getCurrentTime() });
        }
    };


const seek = event => {
        const time = Number(event.target.value);
        if (!canControl || !playerRef.current) return; 
        playerRef.current.seekTo(time, true); 
        socket.emit('seek', { roomId: room.roomId, time });
    };

const assign = (target, role) => socket.emit('assign_role', { roomId: room.roomId, userId: target.userId, role });

const remove = target => socket.emit('remove_participant', { roomId: room.roomId, userId: target.userId });

    const copy = () => {
        navigator.clipboard.writeText(`${location.origin}/room/${room.roomId}`); setNotice('Link copied');
        setTimeout(() => setNotice(''), 1800);
    };


    return (
    <main className="room-shell">
        <nav>
            <div className="brand">
                <span className="brand-mark">▶</span> YT Watch Party
            </div>

            <div className="room-nav">
                <span>ROOM <strong>{room.roomId}</strong></span>
                <button className="copy-button" onClick={copy}>Copy invite link</button>
                <button className="leave" onClick={onLeave}>Leave</button>

            </div>

        </nav>

        {notice && <div className="toast">{notice}</div>}
        <div className="room-layout">
            <section className="watch-column">
                <div className="player-frame">
                    <div ref={playerContainer} className="youtube-player" />
                </div>
                <div className="transport">
                    <button disabled={!canControl} onClick={togglePlayback}>
                        {room.playbackState === 'PLAYING' ? 'Pause' : 'Play'}
                    </button>

                    
            <input aria-label="Seek video" disabled={!canControl || !duration} type="range" min="0" max={duration || 1} step="0.1" value={Math.min(room.currentTime, duration || 1)}                       
            onChange={seek} />
                </div>

                <div className="video-meta"><div>
                    <div className="eyebrow">NOW WATCHING</div><h1>{room.playbackState === 'PLAYING' ? 'The room is playing' : 'Paused for everyone'}
                    </h1>
                </div>
                    <span className={`state-pill ${room.playbackState.toLowerCase()}`}>
                        <i /> {room.playbackState}</span>
                </div>

                <form className="video-change" onSubmit={changeVideo}>
                    <input disabled={!canControl} value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder={canControl ? 'Paste a YouTube URL to change video' : 'Only the host can change the video'} />

                    <button disabled={!canControl} className="primary" type="submit">Change video</button>
                </form>
                <p className="permission-note">{canControl ? 'You have host playback control.' : 'Only the host can control playback and change the video.'}</p>
            </section>
            <aside className="people-panel">
                <div className="panel-heading"><div>
                    <div className="eyebrow">IN THIS ROOM</div>
                    <h2>Participants <span>{room.participants.length}</span>
                    </h2></div><span className="live-dot">LIVE</span>
                </div>

                <div className="people-list">{room.participants.map(participant => <div className="person" key={participant.userId}>
                    <div className="avatar">{participant.username.slice(0, 1).toUpperCase()}</div>
                    <div className="person-main">
                        <strong>{participant.username}{participant.userId === userId && <small> YOU</small>}</strong>

                        <span className={`role ${participant.role.toLowerCase()}`}>{participant.role}</span>
                    </div>

                    {isHost && participant.userId !== userId && <div className="person-actions">
                        <button title="Promote or demote" onClick={() => assign(participant, participant.role === 'MODERATOR' ? 'PARTICIPANT' : 'MODERATOR')}>                       
                         {participant.role === 'MODERATOR' ? 'Demote' : 'Promote'}
                            </button>
                        <button title="Remove participant" onClick={() => remove(participant)}>×</button></div>}</div>)}</div>
                <div className="sync-card"><span className="pulse" /><div>

                    <strong>Room is in sync</strong>

                    <p>Playback updates travel instantly to everyone here.</p>
                </div></div>

            </aside>
            </div>
    </main>);
}

export default App;
