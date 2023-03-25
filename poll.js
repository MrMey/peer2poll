var debug_level = 3;

var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;

var REPLY_TIME_LIMIT = 5000;
var SCORE_DISPLAY_TIME = 5000;

var SINGLE_CORRECT_REPLY_POINTS = 1000;
var MULTI_CORRECT_REPLY_POINTS = 500;


function GetInviteUrl(room_id){
    return window.location.href + "?room_id=" + room_id 
}


class ParticipantModel{
    // any guest view by host
    constructor(peer_id, name, connection, score=0, last_score=0){
        this.peer_id = peer_id
        this.name = name
        this.score = score
        this.conn = connection
        this.last_score = last_score
        this.last_reply_ts = null
        this.last_reply_choice = null
    }
}


class CompetitorModel{
    // any guest view by guest
    constructor(name, score=0, last_score=0){
        this.name = name
        this.score = score
        this.last_score = last_score
    }

    update_score(score, last_score){
        this.score = score
        this.last_score = last_score
    }
}


class GuestModel{
    // a guest view by self
    constructor() {
        this.peer = null
        this.name = null
        this.last_id = null
        this.conn = null
        this.room_id = null
        this.guests = new Map()
        this.question = [
            0,
            "Waiting...",
            {},
        ]
    }    
}

class GuestController{
    receive_data(data){
        console.log(data);
        switch (data["type"]){
            case "question":
                model.question = data["content"];
                view.display_question();
                break;
            case "score":
                Object.entries(data["content"]).forEach(function([peer_id, peer]){
                    if (!model.guests.has(peer_id)){
                        model.guests.set(peer_id, new CompetitorModel(peer["name"]));
                    }
                    model.guests.get(peer_id).update_score(peer["score"], peer["last_score"]);
                })
                view.display_guests();
                break
        }
    }

    set_model_from_url(){
        if (!(model.peer === null)){
            console.log("try to close the connection")
            model.conn.close()
            model.peer.destroy()
            model.peer = null
            model.name = null
            model.room_id = null
            model.last_id = null
            model.conn = null
            model.guests = new Map()           
        }
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
                controller.receive_data(data);
            });
            console.log("attached conn");
        })
    }

    send_choices(choices){
        model.conn.send({
            "type": "choices",
            "content": choices
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
        
        let presentation = document.createElement("div")
        presentation.setAttribute("id", "presentation_guest")

        let slides = document.createElement("div")
        slides.setAttribute("id", "slides")

        presentation.appendChild(slides)
        document.getElementById("playground").appendChild(presentation)

        this.display_question()
    }

    display_guests(){
        let slides = document.getElementById("slides");
        slides.innerHTML = ""
        
        let peer_list = document.createElement("ul");
        peer_list.innerHTML = "Connected peers:";

        model.guests.forEach(function(peer){
            let room_peer = document.createElement("li")
            room_peer.innerHTML = peer.name + ": " + peer.score + "(+" + peer.last_score + ")"
            peer_list.appendChild(room_peer)
        })
        slides.appendChild(peer_list)
    }

    display_question(){
        let slides = document.getElementById("slides");
        slides.innerHTML = ""

        let section = document.createElement("section");
        let div_question = document.createElement("div");
        div_question.innerHTML = model.question[1];
        section.appendChild(div_question);
        slides.appendChild(section)
        
        if (Object.keys(model.question[2]).length > 0){
            let choices_ul = document.createElement("ul")    
            choices_ul.innerHTML = "Choices: "

            Object.entries(model.question[2]).forEach(function([choice, correct]){
                let choice_li = document.createElement("li")
                let input_choice = document.createElement("input");
                input_choice.setAttribute("id", "checkbox_input_" + choice)
                input_choice.setAttribute("type", "checkbox")
                
                choice_li.appendChild(input_choice);
                let choice_label = document.createElement("label")
                choice_label.setAttribute("for", "checkbox_input_" + choice)
                choice_label.innerHTML = choice

                if (correct === true){
                    input_choice.checked = true
                    choice_label.style.backgroundColor = "green"
                }

                choice_li.appendChild(choice_label);

                choices_ul.appendChild(choice_li)
            })
            slides.appendChild(choices_ul)


            let submit_choice = document.createElement("button");
            submit_choice.innerHTML = "Submit"
    
            submit_choice.onclick = function() {
                let choices = []
                Object.keys(model.question[2]).forEach(function(choice){
                    if (document.getElementById("checkbox_input_" + choice).checked){
                        choices.push(choice)
                    }
                })
                controller.send_choices(choices);
            }
            slides.appendChild(submit_choice);
        }
    }
}

class HostModel{
    constructor() {
        this.room_peer = null
        this.last_room_id = null
        this.guests = new Map()
        this.questions = [
            [
                0,
                "Waiting...",
                {},
            ],
            [
                1,
                "what is the best quiz tool ?",
                {"Peer2Poll": true, "Kahoot": false},
            ],
            [
                2,
                "who is the best ?",
                {"Yoda": true, "Dark Vador": true},
            ],
        ]
        this.new_choices = {};
        this.freeze_slide = false;
        this.question_index = 0;
    }

    get_scores(){
        let scores = {}
        model.guests.forEach(function(peer, peer_id){
            scores[peer_id] = {
                "name": peer.name,
                "score": peer.score, 
                "last_score": peer.last_score}
        })
        return scores
    }
}

class HostController{
    constructor(){
        document.onkeydown = function(e){
            e = e || window.event;
            var key = e.which || e.keyCode;
            switch (key){
                case KEY_RIGHT:
                    controller.increase_question_index();
                    break;
                case KEY_LEFT:
                    controller.decrease_question_index();
                    break;
            }
            view.display_presenter()
        }
    }

    increase_question_index(){
        if (model.question_index < model.questions.length - 1){
            model.question_index += 1
        }
    }

    decrease_question_index(){
        if (model.question_index > 0){
            model.question_index -= 1
        }
    }

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
                controller.send_scores();
                controller.send_question(model.questions[0]);
            });

            new_conn.on('data', (data)=>{
                controller.receive_data(new_conn, data)
            });

            new_conn.on('close', ()=>{
                model.guests.delete(new_conn.peer);
                console.log(new_conn.peer + ' has left')
                view.update();
                controller.send_scores();
            });
            
            var attendant = new ParticipantModel(
                new_conn.peer,
                new_conn.metadata["name"],
                new_conn
            )

            model.guests.set(new_conn.peer, attendant)
            console.log("Connected to: " + new_conn.peer);
        });
    }

    receive_data(connection, data){
        console.log(connection.metadata["name"] + " said " + data);
        switch (data["type"]){
            case "choices":
                model.guests.get(connection.peer).last_reply_ts = Date.now()
                model.guests.get(connection.peer).last_reply_choices = data["content"]
                break;
        }
    }

    browse_data(data){
        model.guests.forEach(peer =>{
            peer.conn.send(data);
        })
    }

    send_question(question, concealed){
        if (concealed === true){
            let concealed_choices = {}
            for (let key in question[2]){
                concealed_choices[key] = false
            }
            question = [
                question[0],
                question[1],
                concealed_choices,
            ]
        }

        controller.browse_data({
            "type": "question",
            "content": question
        })
    }

    send_scores(){
        controller.browse_data({
            "type": "score",
            "content": model.get_scores()
        })
    }

    routine_question(){
        controller.increase_question_index()
        view.display_presenter()

        let question = model.questions[model.question_index];
        var nb_correct_choices = 0
        Object.values(question[2]).every(function(value){
            if (value === true){
                nb_correct_choices += 1
            }
        })

        if (nb_correct_choices > 1){
            var points_per_choice = SINGLE_CORRECT_REPLY_POINTS
        } else {
            var points_per_choice = MULTI_CORRECT_REPLY_POINTS
        }
        let now = Date.now()
        controller.send_question(model.questions[model.question_index], true);
        setTimeout(function(){
            console.log("Executed after " + REPLY_TIME_LIMIT);
            model.guests.forEach(function(peer){
                let score = 0;
                let response_time = peer.last_reply_ts - now;
                
                if (peer.last_reply_ts >= now){
                    let multiplier = (1 - (response_time / (2 * REPLY_TIME_LIMIT)))
                    peer.last_reply_choices.forEach(function(choice){
                        if (choice in question[2] && question[2][choice] === true){
                            score += Math.round(multiplier * points_per_choice)
                        }
                    })
                }
                peer.last_score = score;
                peer.score += score;
            })
            view.update();
            controller.send_question(model.questions[model.question_index], false);
            setTimeout(function(){
                controller.send_scores();
            }, SCORE_DISPLAY_TIME)
            
            model.freeze_slide = false
        }, REPLY_TIME_LIMIT);
    }

    start_quiz(){
        model.question_index = 0
        view.display_presenter()

        document.onkeydown = function(e){
            e = e || window.event;
            var key = e.which || e.keyCode;
            switch (key){
                case KEY_RIGHT:
                    if (model.question_index === model.questions.length - 1){
                        break;
                    }
                    if (model.freeze_slide === false){
                        model.freeze_slide = true
                        controller.routine_question()                        
                    }
                    break;
                case KEY_LEFT:
                    console.log("left keyboard is deactivated during quiz")
                    break;
            }
        }
    }

    stop_quiz(){
        document.onkeydown = function(e){
            e = e || window.event;
            var key = e.which || e.keyCode;
            switch (key){
                case KEY_RIGHT:
                    controller.increase_question_index();
                    break;
                case KEY_LEFT:
                    controller.decrease_question_index();
                    break;
            }
        }
        view.display_editor();
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

        let editor = document.createElement("div")
        editor.setAttribute("id", "editor")
        document.getElementById("playground").appendChild(editor)

        let presentation = document.createElement("div")
        presentation.setAttribute("id", "presentation_host")

        let slides = document.createElement("div")
        slides.setAttribute("id", "slides")

        presentation.appendChild(slides)
        document.getElementById("playground").appendChild(presentation)

        view.display_editor()
        view.display_presenter()
    }

    display_editor(){
        let presentation = document.getElementById("editor")
        presentation.innerHTML = "";

        this.display_questions();
    }

    display_presenter(){
        let slides = document.getElementById("slides");
        slides.innerHTML = ""
        let div_question = document.createElement("div");
        div_question.innerHTML = model.questions[model.question_index][1];
        slides.appendChild(div_question);            
        
        if (Object.entries(model.questions[model.question_index][2]).length > 0){
            let choices_ul = document.createElement("ul")    
            choices_ul.innerHTML = "Choices: "
    
            Object.entries(model.questions[model.question_index][2]).forEach(function([choice, correct]){
                let choice_li = document.createElement("li")
                
                let input_choice = document.createElement("input");
                input_choice.setAttribute("id", "checkbox_input_" + choice)
                input_choice.setAttribute("type", "checkbox")
                
                choice_li.appendChild(input_choice);
                let choice_label = document.createElement("label")
                choice_label.setAttribute("for", "checkbox_input_" + choice)
                choice_label.innerHTML = choice

                if (correct === true){
                    input_choice.checked = true
                    choice_label.style.backgroundColor = "green"
                }

                choice_li.appendChild(choice_label);
                choices_ul.appendChild(choice_li)
            })
            slides.appendChild(choices_ul)

        }           
    }

    display_questions(){
        let presentation = document.getElementById("editor")
        presentation.innerHTML = ""

        let question_container = document.createElement("div")    
        question_container.innerHTML = "Questions: "
        question_container.setAttribute("class", "question_container")

        model.questions.forEach(function(question, question_idx){
            let question_box = document.createElement("div")        
            question_box.setAttribute("class", "question_box")


            let question_div = document.createElement("div")
            question_div.innerHTML = question[0] + ": " + question[1]

            question_box.appendChild(question_div)
            
            if (question_idx > 0){
                let delete_question_button = document.createElement("button")
                delete_question_button.innerHTML = "X"
                delete_question_button.onclick = function() {
                    model.questions = model.questions.filter(q => q[0] != question[0])
                    view.display_questions();
                    view.display_presenter();
                }
                
                question_box.appendChild(delete_question_button)
            }

            let choices_ul = document.createElement("ul")
            choices_ul.innerHTML = "Choose among:"
            
            Object.entries(question[2]).forEach(function([choice, correct]){
                let choice_il = document.createElement("li")
                let choice_correct = document.createElement("input")
                choice_correct.setAttribute("type", "checkbox")
                choice_correct.setAttribute("id", "correct_input_" + choice)
                
                if (correct === true){
                    choice_correct.setAttribute("checked", correct)
                }

                choice_correct.onclick = function(){
                    question[2][choice] = !correct
                    view.display_questions()
                }
                let choice_label = document.createElement("label")
                choice_label.setAttribute("for", "correct_input_" + choice)
                choice_label.innerHTML = choice

                choice_il.appendChild(choice_correct)
                choice_il.appendChild(choice_label)
                choices_ul.appendChild(choice_il)  
            })

            question_box.appendChild(choices_ul)
            question_container.appendChild(question_box)
        })

        let new_question_div = document.createElement("div")
        new_question_div.setAttribute("class", "question_box")
        new_question_div.setAttribute("id", "new_question_div")
        question_container.appendChild(new_question_div)
        presentation.appendChild(question_container)

        this.display_new_question();


        let question_export = document.createElement("textarea")
        question_export.setAttribute("id", "export_questions")
        question_export.rows = model.questions.length * 5 + 2
        question_export.innerHTML = JSON.stringify(model.questions, null, 4)
        presentation.appendChild(question_export)

        let submit_button = document.createElement("button")
        submit_button.innerHTML = "Import"
        submit_button.onclick = function() {
            let imported_questions = JSON.parse(document.getElementById("export_questions").value)
            model.questions = imported_questions
            view.display_questions()
        }
        presentation.appendChild(submit_button)

    }

    display_new_question(){
        let new_question_div = document.getElementById("new_question_div")
        new_question_div.innerHTML = "Add a new question:"
                
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
        let choice_il = document.createElement("li")
        let input_new_choice = document.createElement("input");
        input_new_choice.setAttribute("type", "text");
        input_new_choice.setAttribute("id", "new_choice");
        input_new_choice.setAttribute("value", "type your choice")
        choice_il.appendChild(input_new_choice)

        let append_choice_button = document.createElement("button")
        append_choice_button.innerHTML = "+"
        append_choice_button.onclick = function() {
            model.new_choices[document.getElementById("new_choice").value] = false;
            view.display_new_question()
        }
        choice_il.appendChild(append_choice_button)
        new_choices_ul.appendChild(choice_il)
        new_question_div.appendChild(new_choices_ul)
        
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
        if (model.room_peer != null){
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
    
            model.guests.forEach(function(peer){
                let room_peer = document.createElement("li")
                room_peer.innerHTML = peer.name + ": " + peer.score + "(+" + peer.last_score + ")"
                peer_list.appendChild(room_peer)
            })
            peer_list_container.appendChild(peer_list)
        }
        
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