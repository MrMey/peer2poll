var debug_level = 3;


class Question{
    constructor(index, question, choices) {
        this.index = index
        this.question = question
        this.choices = choices
    }
}

class Me{
    constructor(peer) {
        this.peer = peer
        this.name = null
        this.last_id = null
        this.conn = null
        this.score = 0
    }

    connect_to_room(room_id){
        this.name = document.getElementById("participant_name").value;

        this.peer = new Peer();
        console.log("Trying to connect to " + room_id)
        console.log("conn created...")
        
        this.peer.on('open', (id)=>{
            // Workaround for peer.reconnect deleting previous id
            if (this.peer.id === null) {
                console.log('Received null id from peer open');
                this.peer.id = this.last_id;
            } else {
                this.last_id = this.peer.id;
            }
            console.log('peer id: ' + this.peer.id);
            console.log("Ready to connect...");

            this.conn = this.peer.connect(
                room_id,
                {metadata: {"name":this.name}}
                );

            this.conn.on('open', ()=>{
                console.log("Peer connection open...")
                this.conn.send("hi from " + this.peer.id);
                document.getElementById("status").innerHTML = "Connected"
            });

            this.conn.on('error', (err)=>{
                console.log(err);
            });

            this.conn.on('data', (data)=>{
                console.log(data)
            });
            console.log("attached conn");
        })
    }
}


class Room{
    constructor(room_peer) {
        this.room_peer = room_peer
        this.last_room_id = null
        this.connections = new Map()
        this.presenter_mode = false
        this.presenter_index = 0
        this.questions = [
            [
                0,
                "what is the best quiz tool ?",
                {"Peer2Poll": true, "Kahoot": false}
            ],
            [
                1,
                "who is the best ?",
                {"Yoda": true, "Dark Vador": false}
            ],
        ]
    }

    create(){
        this.room_peer = new Peer();
        this.room_peer.on('open', (id)=>{
            // Workaround for peer.reconnect deleting previous id
            if (this.room_peer.id === null) {
                console.log('Received null id from peer open');
                this.room_peer.id = this.last_room_id;
            } else {
                this.last_room_id = this.room_peer.id;
            }
            console.log('room id: ' + this.room_peer.id);
            console.log("Awaiting connection...");
            DisplayRoom(this.room_peer.id);
        });
        this.room_peer.on('connection', (new_conn)=>{
            new_conn.on('open', ()=>{
                console.log(new_conn.peer + ' has joined')
                DisplayRoom();
            });

            new_conn.on('data', (data)=>{
            console.log(data);
            });

            new_conn.on('close', ()=>{
                this.connections.delete(new_conn.peer);
                console.log(new_conn.peer + ' has left')
                DisplayRoom();
            });
            
            var attendant = new Me()
            attendant.conn = new_conn

            this.connections.set(new_conn.peer, attendant)
            console.log("Connected to: " + new_conn.peer);

        });
    }

    reset_presenter_index(){
        this.presenter_index = 0
    }
}


var room = new Room();
var me = new Me();


function CreateRoom(){
    room.create();
}


function CreateOrDetectRoom(){
    urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has("room_id")){
        room_id = urlParams.get("room_id")
        document.getElementById("room_id").innerHTML = room_id

        document.getElementById("container").innerHTML = "";
        var label = document.createElement('label');
        label.setAttribute("for", "participant_name");
        
        var info = document.createElement("div");
        info.innerHTML = "Enter your name";

        var input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("id", "participant_name");
        
        label.appendChild(info);
        label.appendChild(input);
        
        document.getElementById("container").appendChild(label);

        var button = document.createElement("button");
        button.setAttribute("id", "join_room");
        button.innerHTML = "Join Room";
        button.addEventListener("click", JoinRoom);
        document.getElementById("container").appendChild(button);

        DisplayRoomForGuest(room_id);
    }
    else {
        var button = document.createElement("button");
        button.setAttribute("id", "create_room");
        button.innerHTML = "Create Room";
        button.addEventListener("click", CreateRoom);
        document.getElementById("container").appendChild(button);
    }
}

function GetInviteUrl(room_id){
    return window.location.href + "?room_id=" + room_id 
}


function DisplayRoom(room_peer_id){
    room_id = document.getElementById("room_id");
    room_id.value = room_peer_id;

    invite_link = document.getElementById("invite_url_link");
    url = GetInviteUrl(room_peer_id);

    invite_link.href = url;
    invite_link.innerHTML = url;

    peer_list_container = document.getElementById("peer_list_container")
    if (peer_list_container.firstChild){
        peer_list_container.removeChild(peer_list_container.lastChild);
    }
    
    peer_list = document.createElement("ul")    
    peer_list.innerHTML = "Connected peers:"

    room.connections.forEach(function(peer){
        room_peer = document.createElement("li")
        room_peer.innerHTML = peer.conn.metadata["name"]
        peer_list.appendChild(room_peer)
    })
    peer_list_container.appendChild(peer_list)
}


function DisplayRoomForGuest(room_peer_id){
    room_id = document.getElementById("room_id");
    room_id.value = room_peer_id;

    invite_link = document.getElementById("invite_url_link");
    invite_link.href = window.location.href;
    invite_link.innerHTML = window.location.href;
}


function JoinRoom(){
    room_id = document.getElementById("room_id").value;
    me.connect_to_room(room_id);
}


var new_choices = {};


function DisplayNewQuestion(){
    var new_question_div = document.getElementById("new_question_div")
    new_question_div.innerHTML = ""
            
    var input_new_question = document.createElement("input");
    input_new_question.setAttribute("type", "text");
    input_new_question.setAttribute("id", "new_question");
    input_new_question.setAttribute("value", "type your question")
    new_question_div.appendChild(input_new_question)
    
    var new_choices_ul = document.createElement("ul");
    new_choices_ul.setAttribute("id", "new_choices")

    for (const choice in new_choices) {
        choice_il = document.createElement("li")
        choice_il.innerHTML  = choice

        var is_correct_checkbox = document.createElement("input")
        is_correct_checkbox.setAttribute("id", "new_choice_" + choice)
        is_correct_checkbox.setAttribute("type", "checkbox")
        choice_il.appendChild(is_correct_checkbox)
        new_choices_ul.appendChild(choice_il)
    }

    new_question_div.appendChild(new_choices_ul)

    var input_new_choice = document.createElement("input");
    input_new_choice.setAttribute("type", "text");
    input_new_choice.setAttribute("id", "new_choice");
    input_new_choice.setAttribute("value", "type your choice")
    new_question_div.appendChild(input_new_choice)
    
    append_choice_button = document.createElement("button")
    append_choice_button.innerHTML = "Add new choice"
    append_choice_button.onclick = function() {
        new_choices[document.getElementById("new_choice").value] = false;
        DisplayNewQuestion()
    }
    new_question_div.appendChild(append_choice_button)
    
    append_question_button = document.createElement("button")
    append_question_button.innerHTML = "Register new question"
    append_question_button.onclick = function() {
        room.questions.push([
            room.questions.length,
            document.getElementById("new_question").value,
            new_choices,
        ])

        document.getElementById("new_question").value = ""
        new_choices = {}

        DisplayPresenterModeOff();
    }
    new_question_div.appendChild(append_question_button)

    presentation = document.getElementById("presentation")
    presentation.appendChild(new_question_div)
}


function PresentQuestion(){
    slides = document.getElementById("show")
    slides.innerHTML = "";

    current_question = document.createElement("div")
    current_question.setAttribute("id", "present_question")
    current_question.innerHTML = room.questions[room.presenter_index - 1][1]
    slides.appendChild(current_question)

    current_choices = document.createElement("div")
    current_choices.setAttribute("id", "current_choices")
    for (const choice in room.questions[room.presenter_index - 1][2]) {
        current_choice = document.createElement("button")
        current_choice.innerHTML = choice        
        current_choices.appendChild(current_choice)
    }
}


function DisplayPresentation(){
    presentation.appendChild(start_button)

    slides = document.getElementById("show")
    slides.innerHTML = "";

    current_question = document.createElement("div")
    current_question.setAttribute("id", "present_question")
    current_question.innerHTML = "Ready? Type next to start"
    slides.appendChild(current_question)


}


function DisplayPresenterModeOn(){
    presentation = document.getElementById("presentation")
    presentation.innerHTML = "";
    
    start_button = document.createElement("button")
    start_button.innerHTML = "next"
    start_button.onclick = function(){
            if (room.presenter_index < room.questions.length){
                room.presenter_index += 1
            }
            room.connections.forEach(peer => {
                peer.conn.send(room.questions[room.presenter_index - 1])
            })
            PresentQuestion()
    }
    DisplayPresentation()
    
}


function DisplayPresenterModeOff (){
    room.reset_presenter_index()
    presentation = document.getElementById("presentation")
    presentation.innerHTML = "";

    questions_ul = document.createElement("ul")    
    questions_ul.innerHTML = "Questions: "

    room.questions.forEach(function(question){
        question_li = document.createElement("li")

        question_div = document.createElement("div")
        question_div.innerHTML = question[0] + ": " + question[1]

        question_li.appendChild(question_div)

        delete_question_button = document.createElement("button")
        delete_question_button.innerHTML = "X"
        delete_question_button.onclick = function() {
            room.questions = room.questions.filter(q => q[0] != question[0])
            DisplayPresenterModeOff();
        }
        
        
        question_li.appendChild(delete_question_button)

        choices_ul = document.createElement("ul")
        choices_ul.innerHTML = "Choose among:"
        
        for (const choice in question[2]) {
            choice_il = document.createElement("li")
            choice_il.innerHTML  = choice
            choices_ul.appendChild(choice_il)    
        }
        question_li.appendChild(choices_ul)
        questions_ul.appendChild(question_li)
    })
    presentation.appendChild(questions_ul)

    new_question_div = document.createElement("div")
    new_question_div.setAttribute("id", "new_question_div")
    presentation.appendChild(new_question_div)
    DisplayNewQuestion()
}


function Display(){
    urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has("room_id")){
        container = document.getElementById("inner_container")
        presentation = document.createElement("div")
        presentation.setAttribute("id", "presentation")
        container.appendChild(presentation)
        DisplayPresenterModeOn()
    }
    else {
        container = document.getElementById("inner_container")
        switch_mode_button = document.createElement("button")
        switch_mode_button.innerHTML = "Switch"
        switch_mode_button.onclick = function() {
            if (room.presenter_mode == true){
                room.presenter_mode = false
                DisplayPresenterModeOff()
            } else {
                room.presenter_mode = true
                DisplayPresenterModeOn()
            }
        }
        container.appendChild(switch_mode_button)

        presentation = document.createElement("div")
        presentation.setAttribute("id", "presentation")
        container.appendChild(presentation)
        if (room.presenter_mode == false){
            DisplayPresenterModeOff()
        } else {
            DisplayPresenterModeOn()
        }
    }
}