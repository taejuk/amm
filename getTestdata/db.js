var mongoose = require('mongoose');
const uri = 'mongodb://localhost:27017/';

function connectDb(dbname){
    uri += `${dbname}`;
    return mongoose.connect(uri);
}



var db = mongoose.connection;

db.on('error', function(){
    console.log('Connection Failed!');
});

db.once('open', function() {
    console.log('Connected!');
});

var student = mongoose.Schema({
    name : 'string',
    address : 'string',
    age : 'number'
});

var Student = mongoose.model('Schema', student);

// 8. Student 객체를 new 로 생성해서 값을 입력
var newStudent = new Student({name:'Hong Gil Dong', address:'서울시 강남구 논현동', age:'22'});

// 9. 데이터 저장
newStudent.save(function(error, data){
    if(error){
        console.log(error);
    }else{
        console.log('Saved!')
    }
});