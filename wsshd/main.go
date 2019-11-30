package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
)

const (
	addr         = ":6969"
	deleteAction = "delete"
	createAction = "create"
)

type Message struct {
	Action string `json:"action"`
	File   string `json:"file"`
}

type Player struct {
	game        *Game
	conn        *websocket.Conn
	messageChan chan *Message
}

func NewPlayer(game *Game, conn *websocket.Conn) *Player {
	return &Player{game, conn, make(chan *Message)}
}

func (p *Player) receiveUpdates() {
	for {
		msg := new(Message)
		if err := p.conn.ReadJSON(msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Println("could not read message", err)
			}
			break
		}

		switch msg.Action {
		case deleteAction:
			p.game.fileDelete <- msg.File

		case createAction:
			p.game.fileCreate <- msg.File

		default:
			log.Println("unknown action", msg.Action, "received")
			break
		}
	}

	p.conn.Close()
	p.game.playerQuit <- p
}

func (p *Player) sendUpdates() {
	for {
		select {
		case msg := <-p.messageChan:
			if err := p.conn.WriteJSON(msg); err != nil {
				log.Println("could not send", msg.Action, "signal for", msg.File, err)
				break
			}
		}
	}
}

type Game struct {
	players map[*Player]bool

	playerJoin chan *Player
	playerQuit chan *Player
	fileDelete chan string
	fileCreate chan string
}

func NewGame() *Game {
	return &Game{make(map[*Player]bool),
		make(chan *Player),
		make(chan *Player),
		make(chan string),
		make(chan string)}
}

func (g *Game) update() {
	for {
		select {
		case player := <-g.playerJoin:
			log.Println("player joined")
			g.players[player] = true

		case player := <-g.playerQuit:
			log.Println("player quit")
			delete(g.players, player)

		case file := <-g.fileDelete:
			log.Println("deleting", file)
			msg := &Message{deleteAction, file}
			for player := range g.players {
				player.messageChan <- msg
			}

		case file := <-g.fileCreate:
			log.Println("creating", file)
			msg := &Message{createAction, file}
			for player := range g.players {
				player.messageChan <- msg
			}
		}
	}
}

type UpgradeHandler struct {
	game     *Game
	upgrader *websocket.Upgrader
}

func NewUpgradeHandler(game *Game) *UpgradeHandler {
	return &UpgradeHandler{game, new(websocket.Upgrader)}
}

func (uh *UpgradeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := uh.upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("could not upgrade", err)
		return
	}

	player := NewPlayer(uh.game, conn)
	go player.sendUpdates()
	go player.receiveUpdates()
	uh.game.playerJoin <- player
}

func main() {
	var staticPath string
	flag.StringVar(&staticPath, "static-path", "", "path to static files to serve")
	flag.Parse()

	if staticPath == "" {
		fmt.Println("missing required arg -static-path\n")
		flag.PrintDefaults()
		os.Exit(1)
	}

	game := NewGame()
	go game.update()

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(staticPath)))
	mux.Handle("/ws", NewUpgradeHandler(game))

	log.Printf("listening on %s...", addr)
	http.ListenAndServe(addr, mux)
}
