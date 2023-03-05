var debug_level = 3;

var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var REPLY_TIME_LIMIT = 5000;
var REPLY_POINTS = 10000;



function GetInviteUrl(room_id){
    return window.location.href + "?room_id=" + room_id 
}

class GuestModel{
    constructor() {
        this.peer = null
        this.name = null
        this.last_id = null
        this.conn = null
        this.score = 0
        this.room_id = null
        this.last_reply_ts = null
        this.last_reply_choice = null
        this.question = [
            0,
            "Waiting...",
            {},
            {}
        ]
    }

    create_from_conn(conn){
        this.conn = conn
        this.name = conn.metadata["name"]
    }

    
}

class GuestController{
    set_model_from_url(){
        model.name = document.getElementById("participant_name").value;
        model.room_id = urlParams.get("room_id")
        model.peer = new Peer();
        console.log("Trying to connect to " + model.room_id)
        console.log("conn created...")
        
        model.peer.on('open', (id)=>{
            // Workaround for peer.reconnect deleting previous id
            if (model.peer.id === null) {
                console.log('Received null id from peer open');
                model.peer.id = model.last_id;
            } else {
                model.last_id = model.peer.id;
            }
            console.log('peer id: ' + model.peer.id);
            console.log("Ready to connect...");

            model.conn = model.peer.connect(
                model.room_id,
                {metadata: {"name":model.name}}
                );

                model.conn.on('open', ()=>{
                console.log("Peer connection open...")
                model.conn.send("hi from " + model.peer.id);
            });

            model.conn.on('error', (err)=>{
                console.log(err);
            });

            model.conn.on('data', (data)=>{
                model.question = data
                view.display_question()
                console.log(data)
            });
            console.log("attached conn");
        })
    }
}

class GuestView{
    render(){
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
        button.addEventListener("click", controller.set_model_from_url);
        document.getElementById("container").appendChild(button);

        Reveal.initialize({embedded: false, disableLayout: true, overview: false, touch: false})
        this.display_question()
    }

    display_question(){
        let slides = document.getElementById("reveal-slides");
        slides.innerHTML = ""

        let section = document.createElement("section");
        let div_question = document.createElement("div");
        div_question.innerHTML = model.question[1];
        section.appendChild(div_question);
        slides.appendChild(section)

        let editor = document.getElementById("editor");
        editor = document.getElementById("editor");

        for (const choice in model.question[2]) {
            let button_choice = document.createElement("button");
            button_choice.setAttribute("id", choice)
            
            button_choice.innerHTML = choice;
            
            button_choice.onclick = function() {
                model.conn.send(choice);
            }
            
            editor.appendChild(button_choice);
        }            
        
        Reveal.sync()

        document.querySelector( '.reveal' ).style.height = '80vh';
        document.querySelector( '.reveal' ).style.float = 'top';
        document.querySelector( '#editor' ).style.height = '20vh';
        document.querySelector( '#editor' ).style.float = 'top';
        Reveal.layout()
    }
}

class HostModel{
    constructor() {
        this.room_peer = null
        this.last_room_id = null
        this.connections = new Map()
        this.questions = [
            [
                0,
                "what is the best quiz tool ?",
                {"Peer2Poll": true, "Kahoot": false},
                {}
            ],
            [
                1,
                "who is the best ?",
                {"Yoda": true, "Dark Vador": false},
                {}
            ],
        ]
        this.new_choices = {};
    }
}

class HostController{
    create_room(){
        model.room_peer = new Peer();
        model.room_peer.on('open', (id)=>{
            // Workaround for peer.reconnect deleting previous id
            if (model.room_peer.id === null) {
                console.log('Received null id from peer open');
                model.room_peer.id = model.last_room_id;
            } else {
                model.last_room_id = model.room_peer.id;
            }
            console.log('room id: ' + model.room_peer.id);
            console.log("Awaiting connection...");
            view.update();
        });
        model.room_peer.on('connection', (new_conn)=>{
            new_conn.on('open', ()=>{
                console.log(new_conn.peer + ' has joined')
                view.update();
            });

            new_conn.on('data', (data)=>{
                console.log(new_conn.metadata["name"] + " said " + data);
                model.connections.get(new_conn.peer).last_reply_ts = Date.now()
                model.connections.get(new_conn.peer).last_reply_choice = data
            });

            new_conn.on('close', ()=>{
                model.connections.delete(new_conn.peer);
                console.log(new_conn.peer + ' has left')
                view.update();
            });
            
            var attendant = new GuestModel()
            attendant.create_from_conn(new_conn)

            model.connections.set(new_conn.peer, attendant)
            console.log("Connected to: " + new_conn.peer);
        });
    }

    browse_data(data){
        model.connections.forEach(peer =>{
            peer.conn.send(data);
        })
    }

    routine_question(){
        Reveal.right();
        let question = model.questions[Reveal.getProgress()];
        let now = Date.now()
        controller.browse_data(model.questions[Reveal.getProgress()]);
        setTimeout(function(){
            console.log("Executed after " + REPLY_TIME_LIMIT);
            model.connections.forEach(function(peer){
                let score = 0;
                if (peer.last_reply_ts >= now && peer.last_reply_choice in question[2] && question[2][peer.last_reply_choice] === true){
                    score = REPLY_POINTS / (peer.last_reply_ts - now)
                }
                model.questions[Reveal.getProgress()][3][peer.name] = score;
                peer.score += score
            })
            view.update();
            controller.browse_data(model.questions[Reveal.getProgress()])

        }, REPLY_TIME_LIMIT);
    }

    start_quiz(){
        Reveal.removeKeyBinding(KEY_RIGHT);
        Reveal.addKeyBinding(KEY_RIGHT, () => {
            controller.routine_question()
        })
    }

    stop_quiz(){
        Reveal.removeKeyBinding(KEY_RIGHT);
        Reveal.addKeyBinding(KEY_RIGHT, () => {
            Reveal.right();
        })
    }
    
}

class HostView{
    render(){
        let create_room_button = document.createElement("button");
        create_room_button.setAttribute("id", "create_room");
        create_room_button.innerHTML = "Create Room";
        create_room_button.addEventListener("click", controller.create_room);
        document.getElementById("container").appendChild(create_room_button);
        
        let start_quiz_button = document.createElement("button");
        start_quiz_button.setAttribute("id", "start_quiz");
        start_quiz_button.innerHTML = "Start Quiz";
        start_quiz_button.addEventListener("click", controller.start_quiz);
        document.getElementById("container").appendChild(start_quiz_button);
        
        let stop_quiz_button = document.createElement("button");
        stop_quiz_button.setAttribute("id", "stop_quiz");
        stop_quiz_button.innerHTML = "Stop Quiz";
        stop_quiz_button.addEventListener("click", controller.stop_quiz);
        document.getElementById("container").appendChild(stop_quiz_button);

        Reveal.initialize({embedded: false})
        document.querySelector( '#editor' ).style.width = '50vw';
        document.querySelector( '#editor' ).style.float = 'left';
        document.querySelector( '.reveal' ).style.width = '50vw';
        document.querySelector( '.reveal' ).style.float = 'right';

        view.display_editor()
        view.display_presenter()
        Reveal.layout()
    }

    display_editor(){
        let presentation = document.getElementById("editor")
        presentation.innerHTML = "";

        this.display_questions();
    }

    display_presenter(){
        let slides = document.getElementById("reveal-slides");
        slides.innerHTML = ""
        model.questions.forEach(question => {
            let section = document.createElement("section");
            
            let div_question = document.createElement("div");
            div_question.innerHTML = question[1];
            section.appendChild(div_question);
            

            console.log(question[2])
            for (const choice in question[2]) {
                let button_choice = document.createElement("button");
                button_choice.innerHTML = choice;
                button_choice.addEventListener("click", () => {
                    console.log("send ");
                }
                )
                section.appendChild(button_choice);
            }
            
            slides.appendChild(section)
        })
        Reveal.sync()
        Reveal.slide(0)
        
    }

    display_questions(){
        let presentation = document.getElementById("editor")
        presentation.innerHTML = ""
        let questions_ul = document.createElement("ul")    
        questions_ul.innerHTML = "Questions: "

        model.questions.forEach(function(question){
            let question_li = document.createElement("li")

            let question_div = document.createElement("div")
            question_div.innerHTML = question[0] + ": " + question[1]

            question_li.appendChild(question_div)

            let delete_question_button = document.createElement("button")
            delete_question_button.innerHTML = "X"
            delete_question_button.onclick = function() {
                model.questions = model.questions.filter(q => q[0] != question[0])
                view.display_questions();
                view.display_presenter();
            }
            
            question_li.appendChild(delete_question_button)

            let choices_ul = document.createElement("ul")
            choices_ul.innerHTML = "Choose among:"
            
            for (const choice in question[2]) {
                let choice_il = document.createElement("li")
                choice_il.innerHTML  = choice
                choices_ul.appendChild(choice_il)    
            }
            question_li.appendChild(choices_ul)
            questions_ul.appendChild(question_li)
        })
        presentation.appendChild(questions_ul)

        let new_question_div = document.createElement("div")
        new_question_div.setAttribute("id", "new_question_div")
        presentation.appendChild(new_question_div)
        this.display_new_question();

    }

    display_new_question(){
        let new_question_div = document.getElementById("new_question_div")
        new_question_div.innerHTML = ""
                
        let input_new_question = document.createElement("input");
        input_new_question.setAttribute("type", "text");
        input_new_question.setAttribute("id", "new_question");
        input_new_question.setAttribute("value", "type your question")
        new_question_div.appendChild(input_new_question)
        
        let new_choices_ul = document.createElement("ul");
        new_choices_ul.setAttribute("id", "new_choices")

        for (const choice in model.new_choices) {
            let choice_il = document.createElement("li")
            choice_il.innerHTML  = choice

            let is_correct_checkbox = document.createElement("input")
            is_correct_checkbox.setAttribute("id", "new_choice_" + choice)
            is_correct_checkbox.setAttribute("type", "checkbox")
            choice_il.appendChild(is_correct_checkbox)
            new_choices_ul.appendChild(choice_il)
        }

        new_question_div.appendChild(new_choices_ul)

        let input_new_choice = document.createElement("input");
        input_new_choice.setAttribute("type", "text");
        input_new_choice.setAttribute("id", "new_choice");
        input_new_choice.setAttribute("value", "type your choice")
        new_question_div.appendChild(input_new_choice)
        
        let append_choice_button = document.createElement("button")
        append_choice_button.innerHTML = "Add new choice"
        append_choice_button.onclick = function() {
            model.new_choices[document.getElementById("new_choice").value] = false;
            view.display_new_question()
        }
        new_question_div.appendChild(append_choice_button)
        
        let append_question_button = document.createElement("button")
        append_question_button.innerHTML = "Register new question"
        append_question_button.onclick = function() {
            model.questions.push([
                model.questions.length,
                document.getElementById("new_question").value,
                model.new_choices,
                {}
            ])

            document.getElementById("new_question").value = ""
            model.new_choices = {}

            view.display_questions();
            view.display_presenter();
        }
        new_question_div.appendChild(append_question_button)
        }
        
    update(){
        let invite_link = document.getElementById("invite_url_link");

        room_id = document.getElementById("room_id");
        room_id.value = model.room_peer.id;

        let url = GetInviteUrl(model.room_peer.id);

        invite_link.href = url;
        invite_link.innerHTML = url;

        peer_list_container = document.getElementById("peer_list_container")
        if (peer_list_container.firstChild){
            peer_list_container.removeChild(peer_list_container.lastChild);
        }
        
        let peer_list = document.createElement("ul");
        peer_list.innerHTML = "Connected peers:";

        model.connections.forEach(function(peer){
            let room_peer = document.createElement("li")
            room_peer.innerHTML = peer.conn.metadata["name"] + ": " + peer.score
            peer_list.appendChild(room_peer)
        })
        peer_list_container.appendChild(peer_list)
    }
}

urlParams = new URLSearchParams(window.location.search)

if (urlParams.has("room_id")){
    model = new GuestModel()
    view = new GuestView()
    controller = new GuestController()
} else {
    model = new HostModel()
    view = new HostView()
    controller = new HostController()
}